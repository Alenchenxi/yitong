/**
 * P1-02/03/04/05/06/07 smoke（合并一次跑完）
 * 跑法：node apps/server/scripts/smoke-p1-confession-extra.mjs
 * 前置：本地 server 已起（http://localhost:3000），dev mock 模式
 *
 * 说明：
 * - 评论接口限流 5/min/IP；本脚本在每次 POST 评论之间 sleep 13s
 * - mention 通知在 createComment 中是 fire-and-forget，smoke 用 waitNotif poll 直到命中
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const COMMENT_GAP_MS = parseInt(process.env.SMOKE_COMMENT_GAP_MS || '13000', 10);

function nowSuffix() {
  return Date.now().toString(36).slice(-8);
}
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
  const j = await r.json();
  return { status: r.status, body: j };
}

async function callComment(path, token, body) {
  for (let i = 0; i < 3; i++) {
    const r = await call('POST', path, token, body);
    if (r.status === 429) {
      console.log(`  ⏸ 限流，等待 ${COMMENT_GAP_MS}ms 后重试...`);
      await sleep(COMMENT_GAP_MS);
      continue;
    }
    return r;
  }
  return await call('POST', path, token, body);
}

async function waitNotif(token, predicate, timeoutMs = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await call('GET', `/notifications?unreadOnly=0&page=1&pageSize=50`, token);
    if (r.body.code === 0) {
      const hit = r.body.data.list.find(predicate);
      if (hit) return hit;
    }
    await sleep(150);
  }
  return null;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[P1-02~07 smoke] base =', BASE, `gap=${COMMENT_GAP_MS}ms`);
  const sfx = nowSuffix();
  const A = await login(`smk-A-${sfx}-aaaa`, `Alice_${sfx}`);
  const B = await login(`smk-B-${sfx}-bbbb`, `Bob_${sfx}`);
  console.log('  users:', A.user.id, B.user.id);

  // A 发帖带 tag
  const circle = (await call('GET', '/circles', A.accessToken)).body.data[0];
  const postRes = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, {
    content: `smoke ${sfx} 测试 校园 食堂`,
    tags: ['校园', '食堂', `kw_${sfx}`],
  });
  assert(postRes.body.code === 0, 'create post');
  const postId = postRes.body.data.id;

  // B 发顶级评论
  const topRes = await callComment(`/posts/${postId}/comments`, B.accessToken, { content: `nice ${sfx}` });
  assert(topRes.body.code === 0, 'top comment');
  const topId = topRes.body.data.id;

  // === P1-02 评论点赞 toggle ===
  console.log('\n[P1-02] comment like');
  const like1 = await call('POST', `/comments/${topId}/like`, A.accessToken);
  assert(like1.body.code === 0 && like1.body.data.liked === true && like1.body.data.likeCount === 1, 'first like liked=true count=1');
  const like2 = await call('POST', `/comments/${topId}/like`, A.accessToken);
  assert(like2.body.code === 0 && like2.body.data.liked === false && like2.body.data.likeCount === 0, 'second like toggle off');
  const like3 = await call('POST', `/comments/${topId}/like`, A.accessToken);
  assert(like3.body.data.liked === true, 'like on again');
  // 评论点赞通知给 B（poll 等异步）
  const clNotif = await waitNotif(
    B.accessToken,
    (n) => n.type === 'comment_like' && n.extraId === topId,
  );
  assert(clNotif, `B has comment_like notification extraId=${topId}`);
  // 不存在 comment
  const likeBad = await call('POST', `/comments/nonexistent/like`, A.accessToken);
  assert(likeBad.body.code === 20005, 'like non-existent comment -> 20005');

  // 清掉 B 的通知便于后续断言
  await call('POST', `/notifications/read-all`, {}, B.accessToken);

  // === P1-03 @用户 ===
  console.log('\n[P1-03] @mention');
  const atnick = `Alice_${sfx}`;
  const cmRes = await callComment(`/posts/${postId}/comments`, B.accessToken, {
    content: `@${atnick} 快来看 https://example.com @noSuchUser_${sfx}`,
  });
  assert(cmRes.body.code === 0, 'mention comment created');
  const mentId = cmRes.body.data.id;
  // mention 是异步，需要 poll
  const mNotif = await waitNotif(
    A.accessToken,
    (n) => n.type === 'comment_mention' && n.extraId === mentId,
  );
  assert(mNotif, `A receives mention notify extraId=${mentId}`);
  // @不存在用户不应产生对应通知
  await sleep(400);
  const noUserList = await call('GET', `/notifications?unreadOnly=0&page=1&pageSize=50`, A.accessToken);
  const noUserFake = noUserList.body.data.list.find((n) => n.type === 'comment_mention' && /noSuchUser/.test(n.content));
  assert(!noUserFake, 'mention non-existent user no notify');

  // === P1-04 热评置顶 / listComments 字段 ===
  console.log('\n[P1-04] listComments fields');
  const list = await call('GET', `/posts/${postId}/comments?page=1&pageSize=20`, A.accessToken);
  assert(list.body.code === 0, 'listComments');
  const t = list.body.data.list.find((c) => c.id === topId);
  assert(t && typeof t.likeCount === 'number' && typeof t.pinned === 'boolean' && typeof t.liked === 'boolean',
    `comment fields likeCount/pinned/liked present (likeCount=${t?.likeCount}, pinned=${t?.pinned}, liked=${t?.liked})`);

  // === P1-05/06/07 搜索（含路由顺序回归 /posts/search 不应被 /posts/:id 捕走） ===
  console.log('\n[P1-05~07] search');
  // 搜帖子：内容里包含 `测试`（帖子内容用 "smoke <sfx> 测试 校园 食堂" 构造）
  const ps = await call('GET', `/posts/search?q=${encodeURIComponent('测试')}&limit=10`, A.accessToken);
  assert(ps.body.code === 0, `search posts code=${ps.body.code} (路由顺序回归：必须不是 20003)`);
  assert(ps.body.data.list.some((p) => p.id === postId), `keyword 测试 matches our post`);

  const us = await call('GET', `/users/search?q=alice&limit=10`, A.accessToken);
  assert(us.body.code === 0, `search users code=${us.body.code}`);
  assert(us.body.data.list.some((u) => u.nickname === atnick), `find user by alice`);

  const ts = await call('GET', `/tags/search?q=kw_${sfx}&limit=10`, A.accessToken);
  assert(ts.body.code === 0, `search tags code=${ts.body.code}`);
  // 我们的帖子用了 `kw_<sfx>` 标签
  const foundTag = ts.body.data.list.find((tt) => tt.tag === `kw_${sfx}`);
  assert(foundTag && foundTag.postCount >= 1, `kw tag present with count`);

  const hs = await call('GET', `/search/hot`, A.accessToken);
  assert(hs.body.code === 0, `hot list code=${hs.body.code}`);
  assert(Array.isArray(hs.body.data.list), 'hot list array');

  console.log('\n[P1-02~07 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-02~07 smoke] STOPPED:', e.message);
  process.exit(1);
});
