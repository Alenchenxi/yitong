/**
 * P1-01 smoke：表白墙二级评论完整展示
 * 跑法：node apps/server/scripts/smoke-p1-01-comment-thread.mjs
 * 前置：本地 server 已起（http://localhost:3000），dev mock 模式（默认未配 WX 凭证）。
 *
 * 注意：评论接口限流 5/min/IP。smoke 在同一进程连发 8 个评论 POST（3 顶级 + 5 回复）
 * 会触发限流（429）。改为每个 POST 之间 sleep 13s 跨过窗口。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
// 评论限流 5/min/IP = 每 12s 才允许第 6 次。smoke 在一个 60s 窗口内最多只能 5 条评论。
// 因此每两个评论 POST 之间至少 sleep 12s。P1-01 需 ~9 条评论，总耗时 ~108s。
const COMMENT_GAP_MS = parseInt(process.env.SMOKE_COMMENT_GAP_MS || '15000', 10);

function nowSuffix() {
  return Date.now().toString(36).slice(-8);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code) {
  const r = await fetch(`${BASE}/auth/wx-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, role: 'user' }),
  });
  const j = await r.json();
  if (!r.ok || j.code !== 0) throw new Error(`login(${code}) failed: ${r.status} ${JSON.stringify(j)}`);
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

function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('  ✓', msg);
}

// 对每条评论 POST 限流 5/min：若返回 429，sleep 60s 后重试（确保跨过完整窗口）
async function callComment(path, token, body) {
  for (let i = 0; i < 5; i++) {
    const r = await call('POST', path, token, body);
    if (r.status === 429) {
      console.log(`  ⏸ 限流(429)，等待 60s 后重试...`);
      await sleep(60_000);
      continue;
    }
    return r;
  }
  return await call('POST', path, token, body);
}

// 轮询通知直到命中（或超时）
async function waitNotif(token, predicate, timeoutMs = 5000) {
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

(async () => {
  console.log('[P1-01 smoke] base =', BASE, `gap=${COMMENT_GAP_MS}ms`);
  const sfx = nowSuffix();
  const A = await login(`smk-A-${sfx}-aaaa`);
  const B = await login(`smk-B-${sfx}-bbbb`);
  console.log('  users:', A.user.id, B.user.id);

  // A 发帖
  const postRes = await call('POST', `/circles/${(await call('GET', '/circles', A.accessToken)).body.data[0].id}/posts`, A.accessToken, {
    content: `smoke ${sfx} 测试帖`,
  });
  assert(postRes.body.code === 0, `创建帖`);
  const postId = postRes.body.data.id;
  console.log('  post:', postId);

  // B 发 3 条顶级评论（每条 sleep 跨限流）
  const tops = [];
  for (let i = 0; i < 3; i++) {
    const r = await callComment(`/posts/${postId}/comments`, B.accessToken, { content: `top${i}` });
    assert(r.body.code === 0, `top${i} create`);
    tops.push(r.body.data);
    if (i < 2) await sleep(COMMENT_GAP_MS);
  }

  // 对第 1 条顶级评论发 5 条回复（第 3 条 replyToId=第 1 条回复）
  const replies = [];
  for (let i = 0; i < 5; i++) {
    const r = await callComment(`/posts/${postId}/comments`, B.accessToken, {
      content: `r${i}`,
      parentId: tops[0].id,
      replyToId: i === 2 ? replies[0].id : undefined,
    });
    assert(r.body.code === 0, `r${i} create`);
    replies.push(r.body.data);
    if (i < 4) await sleep(COMMENT_GAP_MS);
  }

  // 1) listComments 应带 replyCount 且顶级评论 1 预览最多 3 条
  const lc = await call('GET', `/posts/${postId}/comments?page=1&pageSize=20`, B.accessToken);
  assert(lc.body.code === 0, 'listComments');
  const list = lc.body.data.list;
  assert(list.length === 3, `3 顶级评论, got ${list.length}`);
  const t0 = list.find((x) => x.id === tops[0].id);
  assert(t0 && t0.replyCount === 5, `t0.replyCount=5 got ${t0?.replyCount}`);
  assert(t0.replies.length === 3, `t0.preview<=3 got ${t0.replies.length}`);
  const t0PreviewOrder = t0.replies.map((x) => x.id).join(',');
  const t0ExpectedOrder = [replies[0], replies[1], replies[2]].map((x) => x.id).join(',');
  assert(t0PreviewOrder === t0ExpectedOrder, `t0 preview 升序`);
  const t1 = list.find((x) => x.id === tops[1].id);
  assert(t1 && t1.replyCount === 0, `t1.replyCount=0 got ${t1?.replyCount}`);

  // 2) listReplies 分页（pageSize=2 取 3 页 = 5 条）
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const r = await call('GET', `/posts/${postId}/comments/${tops[0].id}/replies?page=${p}&pageSize=2`, B.accessToken);
    assert(r.body.code === 0, `replies page=${p}`);
    assert(r.body.data.list.length <= 2, `replies page=${p} <=2`);
    all.push(...r.body.data.list);
  }
  const allIds = all.map((x) => x.id);
  const expectedIds = replies.map((x) => x.id);
  assert(all.length === 5, `5 replies total got ${all.length}`);
  assert(JSON.stringify(allIds) === JSON.stringify(expectedIds), `replies ids/order`);
  // 用 reply 的 id 当顶级评论 id 应 20005
  const err = await call('GET', `/posts/${postId}/comments/${replies[0].id}/replies?page=1&pageSize=2`, B.accessToken);
  assert(err.body.code === 20005, `reply id as parent expect 20005 got ${err.body.code}`);

  // 3) locate
  const locTop = await call('GET', `/posts/${postId}/comments/locate?commentId=${tops[0].id}&pageSize=20`, B.accessToken);
  assert(locTop.body.code === 0, 'locate top');
  assert(locTop.body.data.threadRootId === tops[0].id, `locate top threadRootId`);
  assert(locTop.body.data.page === 1, `locate top page=1`);

  const locReply = await call('GET', `/posts/${postId}/comments/locate?commentId=${replies[2].id}&pageSize=20`, B.accessToken);
  assert(locReply.body.code === 0, 'locate reply');
  assert(locReply.body.data.threadRootId === tops[0].id, `locate reply threadRootId=parentId`);

  const locBad = await call('GET', `/posts/${postId}/comments/locate?commentId=non-existent&pageSize=20`, B.accessToken);
  assert(locBad.body.code === 20005, `locate bad expect 20005 got ${locBad.body.code}`);

  // 4) 通知 extraId
  const postCommentNotif = await waitNotif(
    A.accessToken,
    (n) => n.type === 'post_comment' && n.targetId === postId,
  );
  assert(postCommentNotif, 'A 收到 post_comment 通知');
  assert(
    postCommentNotif?.extraId && [tops[0], tops[1], tops[2]].some((t) => t.id === postCommentNotif.extraId),
    `post_comment.extraId 在三条顶级评论中 (got ${postCommentNotif?.extraId})`,
  );

  // A 回复 B 的顶级评论 → B 应收到 comment_reply（评论 POST 也要 sleep）
  const a2 = await callComment(`/posts/${postId}/comments`, A.accessToken, {
    content: 'A 回复 B', parentId: tops[0].id,
  });
  assert(a2.body.code === 0, 'A 回复');
  const replyNotif = await waitNotif(
    B.accessToken,
    (n) => n.type === 'comment_reply' && n.targetId === postId && n.extraId === a2.body.data.id,
  );
  assert(replyNotif, `B 收到 comment_reply 通知 extraId=${a2.body.data.id}`);

  // A 自我回复（评论自己帖的顶级评论）应无自己新通知
  await sleep(COMMENT_GAP_MS);
  const self = await callComment(`/posts/${postId}/comments`, A.accessToken, { content: 'A 自评论' });
  assert(self.body.code === 0, 'self comment');
  await sleep(400);
  const notifsA2 = await call('GET', `/notifications?unreadOnly=0&page=1&pageSize=50`, A.accessToken);
  const duplicated = notifsA2.body.data.list.filter(
    (n) => n.type === 'post_comment' && n.targetId === postId && n.extraId === self.body.data.id,
  );
  assert(duplicated.length === 0, 'A 自评论不该有通知');

  console.log('\n[P1-01 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-01 smoke] STOPPED:', e.message);
  process.exit(1);
});
