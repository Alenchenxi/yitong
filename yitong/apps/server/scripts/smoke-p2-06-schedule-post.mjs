/**
 * P2-06 smoke：定时发布
 * 前置：server dev 模式
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
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
  console.log('[P2-06 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Author_${sfx}`);
  await sleep(14000);

  const circles = await call('GET', '/circles', A.accessToken);
  const circleId = circles.body.data[0].id;

  // 1) 定时发布：publishAt 近未来（5s 后）-> 返回 visibility=DRAFT + publishAt；等 cron 到点转 PUBLIC
  const near = new Date(Date.now() + 5000).toISOString();
  const p1 = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: `P2-06定时帖_${sfx}`, images: [], isAnonymous: false, visibility: 'PUBLIC', publishAt: near,
  });
  assert(p1.body.code === 0, '定时发布建帖成功');
  assert(p1.body.data.visibility === 'DRAFT', `定时帖暂存 DRAFT got ${p1.body.data.visibility}`);
  assert(!!p1.body.data.publishAt, '定时帖带 publishAt');
  const postId = p1.body.data.id;

  // 2) 定时帖不进公开 feed（DRAFT 仅作者可见）
  const feed = await call('GET', '/posts/feed?limit=50&sort=latest', A.accessToken);
  assert(!feed.body.data.list.find((x) => x.id === p1.body.data.id), '定时帖不在公开 feed');

  // 3) 作者我的草稿可见
  const drafts = await call('GET', '/posts/mine/drafts?page=1&pageSize=50', A.accessToken);
  assert(!!drafts.body.data.list.find((x) => x.id === p1.body.data.id), '作者草稿箱含定时帖');

  // 4) 过去时间 publishAt 拒绝
  const past = new Date(Date.now() - 1000).toISOString();
  const badPast = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: 'x', images: [], visibility: 'PUBLIC', publishAt: past,
  });
  assert(badPast.body.code === 20003, `过去时间被拒 20003 got ${badPast.body.code}`);

  // 5) 私密 + publishAt 拒绝
  const future = new Date(Date.now() + 86400000).toISOString();
  const badPrivate = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: 'x', images: [], visibility: 'PRIVATE', publishAt: future,
  });
  assert(badPrivate.body.code === 20003, `私密+定时被拒 20003 got ${badPrivate.body.code}`);

  // 6) 到点发布：publishAt 已设为 5s 后，等 cron 每分钟触发（最多 75s）
  console.log('  ⏳ 等待 cron 每分钟触发定时发布（最多 75s）...');
  let published = false;
  for (let i = 0; i < 15; i++) {
    await sleep(5000);
    const detail = await call('GET', `/posts/${postId}`, A.accessToken);
    if (detail.body.data.visibility === 'PUBLIC' && !detail.body.data.publishAt) {
      published = true;
      break;
    }
  }
  assert(published, 'cron 到点将定时帖转 PUBLIC（清 publishAt）');

  // 7) 转公开后进 feed
  const feed2 = await call('GET', '/posts/feed?limit=50&sort=latest', A.accessToken);
  assert(!!feed2.body.data.list.find((x) => x.id === postId), '转公开后进 feed');

  // 8) 立即发布（无 publishAt）仍正常
  const p2 = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: `P2-06即时帖_${sfx}`, images: [], visibility: 'PUBLIC',
  });
  assert(p2.body.code === 0 && p2.body.data.visibility === 'PUBLIC', '即时发布仍 PUBLIC');
  assert(p2.body.data.publishAt === null, '即时帖 publishAt=null');

  console.log('\n[P2-06 smoke] ALL PASSED');
})().catch(async (e) => {
  console.error('\n[P2-06 smoke] STOPPED:', e.message);
  process.exit(1);
});
