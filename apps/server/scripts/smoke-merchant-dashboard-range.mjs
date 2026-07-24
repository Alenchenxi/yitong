/**
 * P2-16 商家看板时间筛选 smoke：range=day|week|month|all + 非法归 all + 60 天前记录按 range 过滤
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3000 与 docker postgres。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(14000); continue; }
    throw new Error(`login: ${JSON.stringify(j)}`);
  }
  throw new Error('login fail');
}
async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[dashboard-range smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`DA${sfx}`, `Merchant_${sfx}`);
  await sleep(14000);
  const B = await login(`DB${sfx}`, `Stu_${sfx}`);

  // 商家入驻 + 发岗 + 发布
  await call('POST', '/merchant/register', A.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000009',
  });
  const post = await call('POST', '/job-posts', A.accessToken, {
    title: `看板岗位_${sfx}`, description: 'd', salary: '100/天', location: '校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  assert(post.body.code === 0, `发岗成功 ${JSON.stringify(post.body).slice(0, 120)}`);
  const pid = post.body.data.id;
  await call('POST', '/payments/job-publish', A.accessToken, { jobPostId: pid, duration: 'D30' });

  // B 浏览（JobView, createdAt=now）+ 报名（JobApplication, createdAt=now）
  const detail = await call('GET', `/job-posts/${pid}`, B.accessToken);
  assert(detail.body.code === 0, 'B 浏览岗位详情');
  const app = await call('POST', `/job-posts/${pid}/applications`, B.accessToken, {});
  assert(app.body.code === 0, `B 报名 ${JSON.stringify(app.body).slice(0, 120)}`);
  const appId = app.body.data.id;
  await sleep(1000); // 浏览事件 fire-and-forget 落库

  // range=all：包含刚才浏览/报名
  const all1 = await call('GET', '/merchant/dashboard?range=all', A.accessToken);
  assert(all1.body.code === 0, 'range=all 接口');
  assert(all1.body.data.range === 'all', `range 回显=all got ${all1.body.data.range}`);
  assert(all1.body.data.viewCount >= 1, `all viewCount>=1 got ${all1.body.data.viewCount}`);
  assert(all1.body.data.applicationCount === 1, `all applicationCount=1 got ${all1.body.data.applicationCount}`);
  assert(all1.body.data.pendingCount === 1, `all pendingCount=1 got ${all1.body.data.pendingCount}`);
  // 字段完整性
  for (const k of ['viewCount','applicationCount','pendingCount','acceptedCount','completedCount','rejectedCount','cancelledCount','conversionRate','range']) {
    assert(k in all1.body.data, `返回含字段 ${k}`);
  }

  // range=day/week/month：同 24h 内均包含
  for (const r of ['day', 'week', 'month']) {
    const res = await call('GET', `/merchant/dashboard?range=${r}`, A.accessToken);
    assert(res.body.data.range === r, `range 回显=${r} got ${res.body.data.range}`);
    assert(res.body.data.applicationCount === 1, `${r} applicationCount=1 got ${res.body.data.applicationCount}`);
    assert(res.body.data.viewCount >= 1, `${r} viewCount>=1 got ${res.body.data.viewCount}`);
  }

  // 直接 DB 把该报名的 createdAt 改到 60 天前
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const past = new Date(Date.now() - 60 * 86400000);
  await prisma.jobApplication.update({ where: { id: appId }, data: { createdAt: past } });
  const check = await prisma.jobApplication.findUnique({ where: { id: appId }, select: { createdAt: true } });
  await prisma.$disconnect();
  assert(check.createdAt.getTime() < Date.now() - 59 * 86400000, `DB createdAt 已改到 60 天前 got ${check.createdAt.toISOString()}`);

  // range=month：该报名不再计入
  const month2 = await call('GET', '/merchant/dashboard?range=month', A.accessToken);
  assert(month2.body.data.applicationCount === 0, `month(改后) applicationCount=0 got ${month2.body.data.applicationCount}`);
  assert(month2.body.data.pendingCount === 0, `month(改后) pendingCount=0 got ${month2.body.data.pendingCount}`);

  // range=all：该报名仍计入
  const all2 = await call('GET', '/merchant/dashboard?range=all', A.accessToken);
  assert(all2.body.data.applicationCount === 1, `all(改后) applicationCount=1 got ${all2.body.data.applicationCount}`);

  // range=invalid：归 all（含该报名）
  const inv = await call('GET', '/merchant/dashboard?range=weird123', A.accessToken);
  assert(inv.body.data.range === 'all', `invalid 归 all got ${inv.body.data.range}`);
  assert(inv.body.data.applicationCount === 1, `invalid(=all) applicationCount=1 got ${inv.body.data.applicationCount}`);

  // range 省略：归 all
  const omit = await call('GET', '/merchant/dashboard', A.accessToken);
  assert(omit.body.data.range === 'all', `省略 range 归 all got ${omit.body.data.range}`);

  // 非商家账号访问 -> 60002
  const outDash = await call('GET', '/merchant/dashboard?range=all', B.accessToken);
  assert(outDash.body.code === 60002, `非商家 60002 got code=${outDash.body.code} status=${outDash.status}`);

  console.log('\n[dashboard-range smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[dashboard-range smoke] STOPPED:', e.message);
  process.exit(1);
});
