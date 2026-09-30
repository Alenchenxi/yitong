/**
 * P2-15 + P2-16 smoke：兼职精品/招聘数据看板
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 3; i++) {
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
  console.log('[P2-15+P2-16 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Merchant_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `Stu_${sfx}`);
  await sleep(14000);
  await sleep(14000);
  const admin = await login('admin', '管理员', 'admin');
  console.log('  · admin.data keys:', Object.keys(admin));
  console.log('  · admin.role value:', admin.role, 'type:', typeof admin.role);
  const payload = JSON.parse(Buffer.from(admin.accessToken.split('.')[1], 'base64').toString());
  console.log('  · admin jwt role:', payload.role);

  // 商家入驻
  await call('POST', '/merchant/register', A.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000007',
  });
  // 发岗 + 发布
  const post = await call('POST', '/job-posts', A.accessToken, {
    title: `P2-15岗位_${sfx}`, description: 'd', salary: '100/天', location: '校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  const pid = post.body.data.id;
  await call('POST', '/payments/job-publish', A.accessToken, { jobPostId: pid, duration: 'D30' });

  // 商家未设精品前，精品列表不含
  const feat0 = await call('GET', '/job-posts/featured?limit=20', B.accessToken);
  assert(feat0.body.code === 0, '精品列表接口');
  assert(!feat0.body.data.find((p) => p.id === pid), '未设精品不在列表');

  // admin 设精品
  const setF = await call('POST', `/admin/job-posts/${pid}/feature`, admin.accessToken, { featured: true });
  assert(setF.body.code === 0 && setF.body.data.featured === true, 'admin 设精品成功');

  // 精品列表含
  const feat1 = await call('GET', '/job-posts/featured?limit=20', B.accessToken);
  assert(feat1.body.data.find((p) => p.id === pid), '精品列表含该岗');
  assert(feat1.body.data.find((p) => p.id === pid).featured === true, '精品 VO 带 featured=true');

  // ===== P2-16 浏览 + 看板 =====
  // B 浏览详情（产生浏览事件）
  const detail = await call('GET', `/job-posts/${pid}`, B.accessToken);
  assert(detail.body.code === 0, 'B 浏览岗位详情');

  // B 报名
  const app = await call('POST', `/job-posts/${pid}/applications`, B.accessToken, {});
  assert(app.body.code === 0, 'B 报名');

  // 等一下让浏览事件落库（async fire-and-forget）
  await sleep(800);

  // 商家看板
  const dash = await call('GET', '/merchant/dashboard', A.accessToken);
  assert(dash.body.code === 0, '商家看板接口');
  assert(dash.body.data.viewCount >= 1, `浏览数>=1 got ${dash.body.data.viewCount}`);
  assert(dash.body.data.applicationCount === 1, `报名数=1 got ${dash.body.data.applicationCount}`);
  assert(dash.body.data.pendingCount === 1, `待处理=1 got ${dash.body.data.pendingCount}`);
  assert(dash.body.data.conversionRate === 0, `录用前转化率=0% got ${dash.body.data.conversionRate}%`);

  // 录用后转化率变化
  await call('POST', `/applications/${app.body.data.id}/transition`, A.accessToken, { action: 'accept' });
  const dash2 = await call('GET', '/merchant/dashboard', A.accessToken);
  assert(dash2.body.data.acceptedCount === 1, '录用数=1');
  assert(dash2.body.data.conversionRate === 100, `录用后转化率=100% got ${dash2.body.data.conversionRate}%`);

  // 取消精品
  const unF = await call('POST', `/admin/job-posts/${pid}/feature`, admin.accessToken, { featured: false });
  assert(unF.body.data.featured === false, '取消精品');
  const feat2 = await call('GET', '/job-posts/featured?limit=20', B.accessToken);
  assert(!feat2.body.data.find((p) => p.id === pid), '取消后精品列表不含');

  // 非商家访问 60002
  const outDash = await call('GET', '/merchant/dashboard', B.accessToken);
  assert(outDash.body.code === 60002, `非商家看板 60002 got ${outDash.body.code}`);

  console.log('\n[P2-15+P2-16 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-15+P2-16 smoke] STOPPED:', e.message);
  process.exit(1);
});
