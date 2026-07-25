/**
 * feat/admin-tail-3 smoke: 3 项增强契约验证
 *   1. 评论按 authorNickname/postTitleKw 模糊搜索（与 postId/authorId 互斥）
 *   2. revokeMessage 清 ChatSession.lastMessage='[已撤回]'（双向）
 *   3. revokeMessage 时效 2 分钟（超时返 40004）
 *
 * 用法：node apps/server/scripts/smoke-tail3.mjs
 * 可选：BASE_URL / DATABASE_URL。
 * API 429 / code=90001 立即停止不重试。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/yitong';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function parseResponse(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label}: 非 JSON 响应 HTTP ${response.status}`);
  }
  if (response.status === 429 || body?.code === 90001) {
    const error = new Error(`${label}: API 429，立即停止；HTTP ${response.status} ${JSON.stringify(body)}`);
    error.code = 'API_429';
    throw error;
  }
  return { status: response.status, body };
}

async function call(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response, `${method} ${path}`);
}

async function login(code, nickname, role = 'user') {
  const response = await fetch(`${BASE}/auth/wx-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, role, nickname }),
  });
  const result = await parseResponse(response, 'POST /auth/wx-login');
  if (result.body.code !== 0) {
    throw new Error(`登录失败(${role}): ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.data;
}

async function main() {
  console.log(`[admin-tail-3 smoke] HTTP=${BASE}`);
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const uniqKey = `Tail3U_${run}`;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    const admin = await login('admin', 'Tail3Admin', 'admin');
    console.log(`\n[setup] admin.id=${admin.user.id}`);

    // Need a regular user for chat tests
    const userX = await login(`X_${run}`, `User_${run}`);
    const userY = await login(`Y_${run}`, `Buddy_${run}`);

    // ============================================================
    // 1. 评论按昵称/帖子标题搜索
    // ============================================================
    console.log('\n[1.a] authorNickname 模糊筛');
    // 直造 2 个 user：userA 昵称含 uniqKey，userB 不含
    // 用 prisma 直接写库（admin 已存在）
    const circleRow = await prisma.circle.findFirst({ select: { id: true } });
    assert(!!circleRow, '存在 circle 用于造 post/comment');

    // 造 2 个测试 user（昵称：一个含 uniqKey，一个不含）
    const userARow = await prisma.user.create({
      data: {
        openid: `t3A_${run}`,
        nickname: `${uniqKey}A_Nick`,
      },
      select: { id: true, nickname: true },
    });
    const userBRow = await prisma.user.create({
      data: {
        openid: `t3B_${run}`,
        nickname: `Other_B_${run}`,
      },
      select: { id: true, nickname: true },
    });
    console.log(`  setup userA=${userARow.id} nick=${userARow.nickname}`);
    console.log(`  setup userB=${userBRow.id} nick=${userBRow.nickname}`);

    const postA = await prisma.post.create({
      data: {
        circleId: circleRow.id,
        authorId: userX.user.id,
        content: `无关内容_${run}`,
        images: [],
        status: 'APPROVED',
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });

    // 1 个评论归属 userA（昵称含 uniqKey），1 个评论归属 userB（无关）
    const commentKey = `Tail3Cm_${run}`;
    const cmA = await prisma.comment.create({
      data: { postId: postA.id, authorId: userARow.id, content: `${commentKey}_A` },
      select: { id: true, postId: true },
    });
    const cmB = await prisma.comment.create({
      data: { postId: postA.id, authorId: userBRow.id, content: `${commentKey}_B` },
      select: { id: true, postId: true },
    });

    const nickSearch = await call(
      'GET',
      `/admin/comments?authorNickname=${encodeURIComponent(uniqKey)}&pageSize=10`,
      admin.accessToken,
    );
    assert(nickSearch.body.code === 0, `authorNickname search code=0 got=${JSON.stringify(nickSearch.body)}`);
    const nickList = nickSearch.body.data?.list ?? [];
    const nickIds = new Set(nickList.map((c) => c.id));
    assert(nickIds.has(cmA.id), `search by authorNickname 应含 cmA (userA) got=${[...nickIds].join(',')}`);
    assert(!nickIds.has(cmB.id), `search by authorNickname 不应含 cmB (userB) got=${[...nickIds].join(',')}`);
    assert(
      nickList.every((c) => nickIds.has(c.id) && c.id !== cmB.id),
      `nickSearch 列表均匹配 (无 cmB)`,
    );

    console.log('\n[1.b] postTitleKw 模糊筛');
    // 造 2 个不同 content 的 post
    const matchPostContent = `${uniqKey}_POST_BODY`;
    const matchPost = await prisma.post.create({
      data: {
        circleId: circleRow.id,
        authorId: userX.user.id,
        content: `${matchPostContent}_${run}`,
        images: [],
        status: 'APPROVED',
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });
    const noMatchPost = await prisma.post.create({
      data: {
        circleId: circleRow.id,
        authorId: userX.user.id,
        content: `不相关的帖子内容_${run}`,
        images: [],
        status: 'APPROVED',
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });

    const cmMatchPost = await prisma.comment.create({
      data: { postId: matchPost.id, authorId: userX.user.id, content: `${commentKey}_matchPost` },
      select: { id: true, postId: true },
    });
    const cmNoMatchPost = await prisma.comment.create({
      data: { postId: noMatchPost.id, authorId: userX.user.id, content: `${commentKey}_noMatchPost` },
      select: { id: true, postId: true },
    });

    const postTitleSearch = await call(
      'GET',
      `/admin/comments?postTitleKw=${encodeURIComponent(uniqKey)}&pageSize=10`,
      admin.accessToken,
    );
    assert(postTitleSearch.body.code === 0, `postTitleKw search code=0 got=${JSON.stringify(postTitleSearch.body)}`);
    const postTitleList = postTitleSearch.body.data?.list ?? [];
    const postTitleIds = new Set(postTitleList.map((c) => c.id));
    assert(postTitleIds.has(cmMatchPost.id), `postTitleKw 应含 cmMatchPost got=${[...postTitleIds].join(',')}`);
    assert(!postTitleIds.has(cmNoMatchPost.id), `postTitleKw 不应含 cmNoMatchPost got=${[...postTitleIds].join(',')}`);

    console.log('\n[1.c] 互斥优先（精确 postId 优先于 postTitleKw）');
    // 传 cmMatchPost.postId + 一个无关的 postTitleKw，应仅返回属于该 postId 的评论
    const fakeKw = 'XXNONEEXISTENTXX';
    const mutualExclusion = await call(
      'GET',
      `/admin/comments?postId=${cmMatchPost.postId}&postTitleKw=${encodeURIComponent(fakeKw)}&pageSize=10`,
      admin.accessToken,
    );
    assert(mutualExclusion.body.code === 0, `mutual exclusion code=0 got=${JSON.stringify(mutualExclusion.body)}`);
    const meList = mutualExclusion.body.data?.list ?? [];
    const meIds = new Set(meList.map((c) => c.id));
    // 必须包含 cmMatchPost（属于 matchPost）
    assert(meIds.has(cmMatchPost.id), `精确 postId 优先应仍包含 cmMatchPost got=${[...meIds].join(',')}`);
    // 不应包含 cmNoMatchPost（属于 noMatchPost）
    assert(!meIds.has(cmNoMatchPost.id), `精确 postId 优先应排除 cmNoMatchPost got=${[...meIds].join(',')}`);

    // ============================================================
    // 3. 撤回时效（2 分钟内成功）
    // ============================================================
    console.log('\n[2] 撤回时效（立即撤回 = 成功）');
    // 用 treehole 1v1：login userX/Y -> 匿名 token -> match -> 发消息 -> 撤
    const tokXRes = await call('POST', '/treehole/anonymous-token', userX.accessToken);
    const tokYRes = await call('POST', '/treehole/anonymous-token', userY.accessToken);
    assert(tokXRes.body.code === 0 && tokYRes.body.code === 0, 'A/B 匿名 token');
    const tokX = tokXRes.body.data.anonToken;
    const tokY = tokYRes.body.data.anonToken;
    const anonX = tokXRes.body.data.anonId;
    const anonY = tokYRes.body.data.anonId;
    assert(anonX.startsWith('anon_') && anonY.startsWith('anon_'), `anon ids anon_ 前缀 got=${anonX}/${anonY}`);

    const waitX = await call('POST', '/treehole/match', tokX);
    assert(waitX.body.code === 0 && waitX.body.data.waiting === true, 'X 进入等待');
    const matchedY = await call('POST', '/treehole/match', tokY);
    assert(matchedY.body.code === 0 && matchedY.body.data.waiting === false, 'Y 匹配成功');
    const matchedX = await call('POST', '/treehole/match', tokX);
    assert(matchedX.body.code === 0 && matchedX.body.data.waiting === false, 'X 读取匹配成功');
    const matchId = matchedX.body.data.matchId;
    assert(matchId === matchedY.body.data.matchId, 'X/Y matchId 一致');

    const sentX = await call('POST', '/treehole/messages', tokX, {
      peerAnonId: anonY,
      content: `recent-msg-${run}`,
      type: 'text',
    });
    assert(sentX.body.code === 0, `X 发 1v1 消息 code=0 got=${JSON.stringify(sentX.body)}`);
    const recentMsgId = sentX.body.data.id;

    // 立即撤回（< 2 分钟）
    const revokeX = await call(
      'POST',
      `/treehole/chats/${matchId}/messages/${recentMsgId}/revoke`,
      tokX,
    );
    assert(revokeX.body.code === 0, `X 立即撤回 code=0 got=${JSON.stringify(revokeX.body)}`);
    assert(revokeX.body.data.deleted === true, `deleted=true got=${JSON.stringify(revokeX.body.data)}`);
    assert(revokeX.body.data.content === '[已撤回]', `content=[已撤回] got=${revokeX.body.data.content}`);

    console.log('\n[3] 撤回时效（超时返 40004）');
    // X 再发一条消息，把 createdAt 改成 3 分钟前，再撤回
    const sentTimeout = await call('POST', '/treehole/messages', tokX, {
      peerAnonId: anonY,
      content: `stale-msg-${run}`,
      type: 'text',
    });
    assert(sentTimeout.body.code === 0, `X 发超时测试 1v1 消息 code=0`);
    const staleMsgId = sentTimeout.body.data.id;

    // prisma 直改 createdAt 到 3 分钟前
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
    const updatedRow = await prisma.chatMessage.update({
      where: { id: staleMsgId },
      data: { createdAt: threeMinAgo },
    });
    assert(
      Date.now() - updatedRow.createdAt.getTime() > 2 * 60 * 1000,
      `DB createdAt 已推到 2 分钟之前 (delta=${Date.now() - updatedRow.createdAt.getTime()}ms)`,
    );

    // 撤回（应返 40004）
    const revokeTimeout = await call(
      'POST',
      `/treehole/chats/${matchId}/messages/${staleMsgId}/revoke`,
      tokX,
    );
    assert(
      revokeTimeout.body.code === 40004,
      `X 撤回超时消息 code=40004 got=${JSON.stringify(revokeTimeout.body)}`,
    );
    assert(
      typeof revokeTimeout.body.message === 'string' && revokeTimeout.body.message.includes('分钟'),
      `40004 错误消息含「分钟」 got=${revokeTimeout.body.message}`,
    );

    // 消息应未被删除（deletedAt=null）
    const staleRowAfter = await prisma.chatMessage.findUnique({ where: { id: staleMsgId } });
    assert(!!staleRowAfter, `超时消息在 DB 仍存在`);
    assert(staleRowAfter.deletedAt === null, `超时消息 deletedAt=null got=${staleRowAfter.deletedAt}`);

    // ============================================================
    // 2. 清 ChatSession.lastMessage='[已撤回]'（双向）
    // ============================================================
    console.log('\n[4] 清 ChatSession.lastMessage 双向');
    // X 再发一条消息（成功）然后撤回，验证双向 lastMessage
    const sentLast = await call('POST', '/treehole/messages', tokX, {
      peerAnonId: anonY,
      content: `last-msg-${run}`,
      type: 'text',
    });
    assert(sentLast.body.code === 0, `X 发最后 1v1 消息 code=0`);
    const lastMsgId = sentLast.body.data.id;

    const revokeLast = await call(
      'POST',
      `/treehole/chats/${matchId}/messages/${lastMsgId}/revoke`,
      tokX,
    );
    assert(revokeLast.body.code === 0, `X 撤回最后 1v1 消息 code=0 got=${JSON.stringify(revokeLast.body)}`);

    // 查双向 ChatSession：ownerId=anonX peerId=anonY + ownerId=anonY peerId=anonX
    const sessionXY = await prisma.chatSession.findUnique({
      where: { ownerId_peerId: { ownerId: anonX, peerId: anonY } },
    });
    const sessionYX = await prisma.chatSession.findUnique({
      where: { ownerId_peerId: { ownerId: anonY, peerId: anonX } },
    });
    assert(!!sessionXY, `ChatSession X→Y 存在`);
    assert(!!sessionYX, `ChatSession Y→X 存在`);
    assert(sessionXY.lastMessage === '[已撤回]', `X→Y lastMessage=[已撤回] got=${sessionXY.lastMessage}`);
    assert(sessionYX.lastMessage === '[已撤回]', `Y→X lastMessage=[已撤回] got=${sessionYX.lastMessage}`);

    // ============================================================
    // 5. 群撤回回归（无需 WS，只验证 API 行为）
    // ============================================================
    console.log('\n[5] 群撤回回归');
    const createdGroup = await call('POST', '/treehole/groups', tokX, {
      name: `T3群撤回回归_${run}`,
      maxMembers: 10,
    });
    assert(createdGroup.body.code === 0, `X 建群 code=0 got=${JSON.stringify(createdGroup.body)}`);
    const groupId = createdGroup.body.data.id;
    const joinedY = await call('POST', `/treehole/groups/${groupId}/join`, tokY);
    assert(joinedY.body.code === 0, `Y 加群 code=0 got=${JSON.stringify(joinedY.body)}`);

    const groupSent = await call('POST', `/treehole/groups/${groupId}/messages`, tokX, {
      content: `group-tail3-${run}`,
      type: 'text',
    });
    assert(groupSent.body.code === 0, `X 发群消息 code=0 got=${JSON.stringify(groupSent.body)}`);
    const groupMsgId = groupSent.body.data.id;

    const groupRevoke = await call(
      'POST',
      `/treehole/groups/${groupId}/messages/${groupMsgId}/revoke`,
      tokX,
    );
    assert(groupRevoke.body.code === 0, `X 撤回群消息 code=0 got=${JSON.stringify(groupRevoke.body)}`);
    assert(groupRevoke.body.data.deleted === true, `群撤回 deleted=true got=${JSON.stringify(groupRevoke.body.data)}`);
    assert(groupRevoke.body.data.content === '[已撤回]', `群撤回 content=[已撤回] got=${groupRevoke.body.data.content}`);

    // 群撤回不应清 ChatSession.lastMessage（仅 1v1 走 chatSession 双更逻辑）
    const sessionXYAfterGroup = await prisma.chatSession.findUnique({
      where: { ownerId_peerId: { ownerId: anonX, peerId: anonY } },
    });
    assert(
      sessionXYAfterGroup && sessionXYAfterGroup.lastMessage === '[已撤回]',
      `群撤回不应触碰 ChatSession.lastMessage（仍为上次 1v1 撤回后的 [已撤回]） got=${sessionXYAfterGroup?.lastMessage}`,
    );

    console.log('\n[admin-tail-3 smoke] ALL PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error?.code === 'API_429') {
    console.error(`\n[admin-tail-3 smoke] API 429 STOPPED: ${error.message}`);
  } else {
    console.error(`\n[admin-tail-3 smoke] FAILED: ${error.stack || error.message}`);
  }
  process.exit(1);
});
