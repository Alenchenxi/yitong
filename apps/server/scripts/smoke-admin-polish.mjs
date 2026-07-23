/**
 * admin polish smoke：帖子置顶加精（queue）+ 岗位精品 + 标签 toggle + 工单保留处理
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
  console.log('[admin-polish smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const U = await login(`U${sfx}`, `User_${sfx}`, 'user');
  await sleep(14000);
  await sleep(14000);
  const admin = await login('admin', '管理员', 'admin');

  // ===== 帖子置顶/加精（getQueue posts 带 pinned/featured）=====
  // 用户发帖
  const circles = await call('GET', '/circles', U.accessToken);
  const circleId = circles.body.data[0].id;
  const post = await call('POST', `/circles/${circleId}/posts`, U.accessToken, {
    content: `admin优化帖_${sfx}`, images: [], isAnonymous: false, visibility: 'PUBLIC',
  });
  const pid = post.body.data.id;

  // admin getQueue posts 含 pinned/featured
  const queue = await call('GET', '/admin/queue', admin.accessToken);
  const p0 = queue.body.data.posts.find((p) => p.id === pid);
  assert(!!p0, 'queue 含该帖');
  assert(p0.pinned === false && p0.featured === false, 'queue 帖带 pinned/featured=false');

  // admin 置顶
  const pin = await call('POST', `/admin/posts/${pid}/pin`, admin.accessToken, { pinned: true });
  assert(pin.body.code === 0 && pin.body.data.pinned === true, '置顶成功');
  // admin 加精
  const fea = await call('POST', `/admin/posts/${pid}/feature`, admin.accessToken, { featured: true });
  assert(fea.body.code === 0 && fea.body.data.featured === true, '加精成功');

  // queue 帖状态更新
  const queue2 = await call('GET', '/admin/queue', admin.accessToken);
  const p1 = queue2.body.data.posts.find((p) => p.id === pid);
  assert(p1.pinned === true && p1.featured === true, 'queue 帖 pinned/featured=true');

  // ===== 岗位精品（admin job-posts 列表）=====
  const M = await login(`M${sfx}`, `Merchant_${sfx}`, 'user');
  await sleep(14000);
  await call('POST', '/merchant/register', M.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000010',
  });
  const job = await call('POST', '/job-posts', M.accessToken, {
    title: `admin优化岗_${sfx}`, description: 'd', salary: '100/天', location: '校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  const jid = job.body.data.id;

  // admin job-posts 列表含 featured
  const jobs = await call('GET', '/admin/job-posts?limit=50', admin.accessToken);
  assert(jobs.body.code === 0, 'admin 岗位列表');
  const j0 = jobs.body.data.find((j) => j.id === jid);
  assert(!!j0 && j0.featured === false, '岗位列表含 featured=false');

  // admin 设精品
  const jf = await call('POST', `/admin/job-posts/${jid}/feature`, admin.accessToken, { featured: true });
  assert(jf.body.code === 0 && jf.body.data.featured === true, '岗位设精品');

  // ===== 标签 toggle（updateAnonTag）=====
  // 先建标签
  const tag = await call('POST', '/admin/anon-tags', admin.accessToken, { name: `优${sfx.slice(-6)}`, category: 'mood' });
  const tagId = tag.body.data.id;
  assert(tag.body.code === 0, '建标签');
  // toggle 停用
  const tg = await call('PUT', `/admin/anon-tags/${tagId}`, admin.accessToken, { active: false });
  assert(tg.body.code === 0 && tg.body.data.active === false, '标签停用');
  // toggle 启用
  const tg2 = await call('PUT', `/admin/anon-tags/${tagId}`, admin.accessToken, { active: true });
  assert(tg2.body.data.active === true, '标签启用');

  // ===== 工单保留处理中（reply close=false -> IN_PROGRESS）=====
  const t = await call('POST', '/support/tickets', U.accessToken, { title: '优化工单', content: 'test' });
  const tid = t.body.data.id;
  const reply = await call('POST', `/admin/tickets/${tid}/reply`, admin.accessToken, { reply: '处理中', close: false });
  assert(reply.body.code === 0 && reply.body.data.status === 'IN_PROGRESS', '回复保留 IN_PROGRESS');
  // 再回复关闭
  const reply2 = await call('POST', `/admin/tickets/${tid}/reply`, admin.accessToken, { reply: '已处理', close: true });
  assert(reply2.body.data.status === 'CLOSED', '回复关闭 CLOSED');

  console.log('\n[admin-polish smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[admin-polish smoke] STOPPED:', e.message);
  process.exit(1);
});
