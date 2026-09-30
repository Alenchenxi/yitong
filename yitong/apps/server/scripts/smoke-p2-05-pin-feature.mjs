/**
 * P2-05 smoke：帖子置顶/加精后台能力
 * 前置：server dev 模式；seed admin（login code='admin' role='admin'）
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
  console.log('[P2-05 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  const A = await login(`A${sfx}`, `Author_${sfx}`);
  await sleep(14000);
  const admin = await login('admin', '管理员', 'admin');

  const circles = await call('GET', '/circles', A.accessToken);
  const circleId = circles.body.data[0].id;

  // 发 2 帖
  const p1 = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: `P2-05帖1_${sfx}`, images: [], isAnonymous: false, visibility: 'PUBLIC',
  });
  const p2 = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: `P2-05帖2_${sfx}`, images: [], isAnonymous: false, visibility: 'PUBLIC',
  });
  const id1 = p1.body.data.id;
  const id2 = p2.body.data.id;

  // 非管理员不能置顶
  const forbid = await call('POST', `/admin/posts/${id1}/pin`, A.accessToken, { pinned: true });
  assert(forbid.body.code === 10003, `非管理员置顶被拒 10003 got ${forbid.body.code}`);

  // admin 置顶 p1
  const pin1 = await call('POST', `/admin/posts/${id1}/pin`, admin.accessToken, { pinned: true });
  assert(pin1.body.code === 0 && pin1.body.data.pinned === true, '置顶 p1 成功');
  // admin 加精 p2
  const fea2 = await call('POST', `/admin/posts/${id2}/feature`, admin.accessToken, { featured: true });
  assert(fea2.body.code === 0 && fea2.body.data.featured === true, '加精 p2 成功');

  // 帖子详情带 pinned/featured
  const detail = await call('GET', `/posts/${id1}`, A.accessToken);
  assert(detail.body.data.pinned === true, '详情 p1 pinned=true');
  const detail2 = await call('GET', `/posts/${id2}`, A.accessToken);
  assert(detail2.body.data.featured === true, '详情 p2 featured=true');

  // feed 首页：p1（置顶）应排在 p2 前（即使 p2 更新）
  const feed = await call('GET', '/posts/feed?limit=20&sort=latest', A.accessToken);
  const idx1 = feed.body.data.list.findIndex((x) => x.id === id1);
  const idx2 = feed.body.data.list.findIndex((x) => x.id === id2);
  assert(idx1 >= 0 && idx2 >= 0, 'feed 首页含 p1/p2');
  assert(idx1 < idx2, `置顶 p1 排 p2 前 got p1@${idx1} p2@${idx2}`);
  assert(feed.body.data.list[idx1].pinned === true, 'feed p1 带 pinned=true');

  // 翻页：置顶帖不重复（第 2 页不应含 p1）
  const page2 = await call('GET', `/posts/feed?limit=20&sort=latest&cursor=${encodeURIComponent(feed.body.data.nextCursor)}`, A.accessToken);
  const idx1page2 = page2.body.data.list.findIndex((x) => x.id === id1);
  assert(idx1page2 < 0, '翻页第 2 页不含置顶 p1（不重复）');

  // hot-top：置顶优先
  const hot = await call('GET', '/posts/hot-top?limit=10', A.accessToken);
  const hIdx1 = hot.body.data.list.findIndex((x) => x.id === id1);
  const hIdx2 = hot.body.data.list.findIndex((x) => x.id === id2);
  if (hIdx1 >= 0 && hIdx2 >= 0) {
    assert(hIdx1 < hIdx2, `hot-top 置顶 p1 排 p2 前 got p1@${hIdx1} p2@${hIdx2}`);
  }

  // 取消置顶/加精
  const unpin = await call('POST', `/admin/posts/${id1}/pin`, admin.accessToken, { pinned: false });
  assert(unpin.body.data.pinned === false, '取消置顶成功');
  const unfea = await call('POST', `/admin/posts/${id2}/feature`, admin.accessToken, { featured: false });
  assert(unfea.body.data.featured === false, '取消加精成功');

  // 取消后 feed 不再置顶（p1 不强制排前；只要 pinned 字段为 false）
  const detailAfter = await call('GET', `/posts/${id1}`, A.accessToken);
  assert(detailAfter.body.data.pinned === false, '取消后 p1 pinned=false');

  // 不存在帖子置顶 40001
  const notExist = await call('POST', `/admin/posts/cmx_nonexistent/pin`, admin.accessToken, { pinned: true });
  assert(notExist.body.code === 40001, `不存在帖子 40001 got ${notExist.body.code}`);

  console.log('\n[P2-05 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-05 smoke] STOPPED:', e.message);
  process.exit(1);
});
