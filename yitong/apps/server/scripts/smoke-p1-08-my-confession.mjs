/**
 * P1-08 smoke：我的表白墙（我的发布/点赞/收藏/评论）
 * 跑法：node apps/server/scripts/smoke-p1-08-my-confession.mjs
 * 前置：本地 server 已起，dev mock 模式
 *
 * 注意：评论接口限流 5/min/IP；本脚本只用 2 条评论创建（被评论的帖子）+ 1 个赞 + 1 个收藏。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const COMMENT_GAP_MS = parseInt(process.env.SMOKE_COMMENT_GAP_MS || '15000', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  const r = await fetch(`${BASE}/auth/wx-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, role: 'user', nickname }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`login failed: ${JSON.stringify(j)}`);
  return j.data;
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
async function callComment(path, token, body) {
  for (let i = 0; i < 5; i++) {
    const r = await call('POST', path, token, body);
    if (r.status === 429) {
      console.log(`  ⏸ 限流，等待 60s...`);
      await sleep(60_000);
      continue;
    }
    return r;
  }
  return await call('POST', path, token, body);
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[P1-08 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`my-A-${sfx}-aaaa`, `MyAlice_${sfx}`);
  const B = await login(`my-B-${sfx}-bbbb`, `MyBob_${sfx}`);
  console.log('  users:', A.user.id, B.user.id);

  const circle = (await call('GET', '/circles', A.accessToken)).body.data[0];

  // A 发 2 个帖子
  const p1 = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, { content: `我的发布1 ${sfx}` });
  const p2 = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, { content: `我的发布2 ${sfx}` });
  assert(p1.body.code === 0 && p2.body.code === 0, 'A 发 2 个帖子');
  const postIds = [p1.body.data.id, p2.body.data.id];

  // A 给 p1 点赞
  const like = await call('POST', `/posts/${p1.body.data.id}/like`, A.accessToken);
  assert(like.body.data.liked === true, 'A 赞 p1');

  // A 收藏 p2
  const fav = await call('POST', `/favorites`, A.accessToken, { targetType: 'post', targetId: p2.body.data.id });
  assert(fav.body.data.favorited === true, 'A 收藏 p2');

  // B 给 p1 评论（让 A 出现在 p1 的评论者列表）
  const bComment = await callComment(`/posts/${p1.body.data.id}/comments`, B.accessToken, { content: 'bob 评论' });
  assert(bComment.body.code === 0, 'B 评论 p1');

  // 1) 我的发布
  console.log('\n[1] my posts /posts/mine');
  const myPosts = await call('GET', `/posts/mine`, A.accessToken);
  assert(myPosts.body.code === 0, 'listMyPosts code=0');
  assert(myPosts.body.data.list.length >= 2, `>=2 posts got ${myPosts.body.data.list.length}`);
  assert(myPosts.body.data.list.every((p) => postIds.includes(p.id)), 'all are A posts');

  // 2) 我点赞的帖子
  console.log('\n[2] my liked /posts/mine/liked');
  const liked = await call('GET', `/posts/mine/liked?page=1&pageSize=20`, A.accessToken);
  assert(liked.body.code === 0, 'listMyLikedPosts code=0');
  assert(liked.body.data.list.some((p) => p.id === p1.body.data.id), 'A 点赞的 p1 出现在列表中');
  assert(!liked.body.data.list.some((p) => p.id === p2.body.data.id), 'A 未点赞的 p2 不在');

  // 3) 我收藏的帖子（前端用 favorites 接口）
  console.log('\n[3] my favorites /favorites?targetType=post');
  const favs = await call('GET', `/favorites?targetType=post&page=1&pageSize=20`, A.accessToken);
  assert(favs.body.code === 0, 'listFavorites code=0');
  assert(favs.body.data.list.some((f) => f.targetId === p2.body.data.id), 'A 收藏的 p2 出现在 favorites');

  // 4) 我评论过的帖子（B 评论 p1 → B 的列表里有 p1；A 自己没评论任何帖 → 列表为空）
  console.log('\n[4] my commented /posts/mine/commented');
  const commentedB = await call('GET', `/posts/mine/commented?page=1&pageSize=20`, B.accessToken);
  assert(commentedB.body.code === 0, 'listMyCommentedPosts code=0');
  assert(commentedB.body.data.list.some((p) => p.id === p1.body.data.id), 'B 评论过的 p1 出现');

  const commentedA = await call('GET', `/posts/mine/commented?page=1&pageSize=20`, A.accessToken);
  assert(commentedA.body.data.list.length === 0, `A 未评论任何帖应空, got ${commentedA.body.data.list.length}`);

  // 5) 我的点赞列表 — 取消点赞应从列表消失
  console.log('\n[5] unlike removes from liked list');
  const unlike = await call('POST', `/posts/${p1.body.data.id}/like`, A.accessToken);
  assert(unlike.body.data.liked === false, 'toggle off');
  const likedAfter = await call('GET', `/posts/mine/liked?page=1&pageSize=20`, A.accessToken);
  assert(!likedAfter.body.data.list.some((p) => p.id === p1.body.data.id), 'p1 不再出现在 liked');

  console.log('\n[P1-08 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-08 smoke] STOPPED:', e.message);
  process.exit(1);
});
