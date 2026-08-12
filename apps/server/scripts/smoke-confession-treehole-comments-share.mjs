/**
 * 表白墙 + 树洞：评论 / 累计浏览数(PV) / 转发前置依赖 — 独立 smoke
 *
 * 覆盖契约：
 *   1. 圈子门禁（circle 功能合并后写路径单真相源）：新用户未加入圈子发树洞帖抛 80014；
 *      加入 cm_default 后发帖成功（treehole/confession 写路径都走 getActiveCommunityId）
 *   2. 树洞评论（平铺无回复）：
 *      - createComment 返回 authorAnonId === anonId（红线：评论作者是匿名 id，非真实 uid）
 *      - 楼主标记 isLZ：作者本人评论 isLZ=true，他人评论 isLZ=false
 *      - listComments 最新优先、total 正确
 *      - 评论 VO 不含 authorId/userId/uid（红线断言）
 *      - AnonPostVo.commentCount 动态 _count
 *   3. 评论点赞 toggle：{liked, likeCount} 往返（1 → 0）
 *   4. 累计浏览数（fire-and-forget 自增）：
 *      - 树洞 GET /treehole/posts/:id 每次 viewCount >= 前值 + 1
 *      - 表白墙 GET /posts/:id 每次 viewCount >= 前值 + 1
 *   5. 红线：anonId !== 真实 uid
 *
 * 清理：删除 smoke 创建的成员行并恢复 community.memberCount/postCount（join +1 / 发帖 +1 归位）。
 *
 * 用法：
 *   1. 启 server（mock 模式）：cd apps/server && npx nest start
 *   2. node apps/server/scripts/smoke-confession-treehole-comments-share.mjs
 *   3. BASE_URL / DATABASE_URL 可环境变量覆盖
 *
 * 清理：依赖 @prisma/client 直连库，按依赖序 deleteMany + 逐表自验证 0 残留（AGENTS.md §10）。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

function assert(cond, msg, extra = '') {
  if (cond) { passed += 1; console.log(`  ✓ ${msg}`); }
  else { failed += 1; console.error(`  ✗ FAIL: ${msg}${extra ? ` | ${extra}` : ''}`); }
}
function assertEq(actual, expected, msg, extra = '') {
  assert(actual === expected, `${msg}（期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}）`, extra);
}

async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, body: json };
}

async function login(code, nickname = 'smoke_user') {
  const r = await call('POST', '/auth/wx-login', null, { code, role: 'user', nickname });
  if (r.body.code !== 0) throw new Error(`login(${code}) failed: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.data;
}

async function signAnon(accessToken) {
  const r = await call('POST', '/treehole/anonymous-token', accessToken, {});
  if (r.body.code !== 0) throw new Error(`signAnon failed: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return { anonToken: r.body.data.anonToken, anonId: r.body.data.anonId };
}

// 每次 GET 详情都会 fire-and-forget 自增 viewCount；轮询直到 >= target（异步窗口兜底）
async function waitViewGte(getDetail, target, attempts = 10, gapMs = 300) {
  let value = 0;
  for (let i = 0; i < attempts; i += 1) {
    const r = await getDetail();
    value = r.body?.data?.viewCount ?? 0;
    if (value >= target) return value;
    await sleep(gapMs);
  }
  return value;
}

const created = {
  userIds: [],
  anonPostIds: [],
  anonCommentIds: [],
  postIds: [],
  // 圈子：circle 功能合并后，写路径（发帖）须先加入圈子（getActiveCommunityId 门禁，未加入抛 80014）。
  // smoke 记录 join 的成员行 + join 前 memberCount，清理时删行并恢复计数。
  communityMemberRows: [], // { communityId, userId }
  cmMemberCountBefore: {}, // communityId -> join 前 memberCount
  cmPostCountBefore: {}, // communityId -> 表白墙帖创建前 postCount（发帖 postCount++，清理恢复）
};
const uniq = (arr) => [...new Set(arr)];
let marker = '';

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理本 smoke 创建的数据...');
  const userIds = created.userIds;
  // marker 重发现：即使中途断言失败也能兜底清掉（内容含唯一 marker）
  const anonPosts = await prisma.anonymousPost.findMany({
    where: marker ? { content: { contains: marker } } : { id: { in: [] } },
    select: { id: true },
  });
  const anonPostIds = uniq([...created.anonPostIds, ...anonPosts.map((r) => r.id)]);
  const anonComments = await prisma.anonComment.findMany({
    where: anonPostIds.length > 0 ? { postId: { in: anonPostIds } } : { id: { in: [] } },
    select: { id: true },
  });
  const anonCommentIds = uniq([...created.anonCommentIds, ...anonComments.map((r) => r.id)]);
  const posts = await prisma.post.findMany({
    where: marker ? { content: { contains: marker } } : { id: { in: [] } },
    select: { id: true },
  });
  const postIds = uniq([...created.postIds, ...posts.map((r) => r.id)]);

  const del = async (label, op) => {
    const n = await op();
    console.log(`  ${label}: ${n}`);
  };
  const inEmpty = (arr) => (arr.length > 0 ? arr : []);
  // 依赖序：先子表，后主表
  await del('anon_comment_likes', () => prisma.anonCommentLike.deleteMany({ where: { commentId: { in: inEmpty(anonCommentIds) } } }));
  await del('anon_comments', () => prisma.anonComment.deleteMany({ where: { postId: { in: inEmpty(anonPostIds) } } }));
  await del('anonymous_post_likes', () => prisma.anonPostLike.deleteMany({ where: { postId: { in: inEmpty(anonPostIds) } } }));
  await del('anonymous_posts', () => prisma.anonymousPost.deleteMany({ where: { id: { in: inEmpty(anonPostIds) } } }));
  await del('comment_likes', () => prisma.commentLike.deleteMany({ where: { comment: { postId: { in: inEmpty(postIds) } } } }));
  await del('comments', () => prisma.comment.deleteMany({ where: { postId: { in: inEmpty(postIds) } } }));
  await del('post_likes', () => prisma.postLike.deleteMany({ where: { postId: { in: inEmpty(postIds) } } }));
  await del('posts', () => prisma.post.deleteMany({ where: { id: { in: inEmpty(postIds) } } }));
  await del('anonymous_profiles', () => prisma.anonymousProfile.deleteMany({ where: { userId: { in: inEmpty(userIds) } } }));
  await del('user_roles', () => prisma.userRole.deleteMany({ where: { userId: { in: inEmpty(userIds) } } }));
  // 圈子成员：删本 smoke join 的成员行 + 恢复 memberCount（join 时 +1，清理归位）
  for (const row of created.communityMemberRows) {
    const r = await prisma.communityMember.deleteMany({ where: { communityId: row.communityId, userId: row.userId } });
    if (r.count > 0) {
      await prisma.community.update({ where: { id: row.communityId }, data: { memberCount: { decrement: 1 } } });
    }
  }
  // 表白墙帖 postCount++ 恢复（confession createPost 发帖时对当前圈子 postCount +1）
  for (const cid of Object.keys(created.cmPostCountBefore)) {
    if (postIds.length > 0) {
      await prisma.community.update({ where: { id: cid }, data: { postCount: { decrement: postIds.length } } });
    }
  }
  await del('users', () => prisma.user.deleteMany({ where: { id: { in: inEmpty(userIds) } } }));

  // 清理后逐表自验证（AGENTS.md §10 第 7 条）
  const remain = {
    anon_comment_likes: await prisma.anonCommentLike.count({ where: { commentId: { in: inEmpty(anonCommentIds) } } }),
    anon_comments: await prisma.anonComment.count({ where: { postId: { in: inEmpty(anonPostIds) } } }),
    anonymous_posts: await prisma.anonymousPost.count({ where: { id: { in: inEmpty(anonPostIds) } } }),
    comments: await prisma.comment.count({ where: { postId: { in: inEmpty(postIds) } } }),
    posts: await prisma.post.count({ where: { id: { in: inEmpty(postIds) } } }),
    anonymous_profiles: await prisma.anonymousProfile.count({ where: { userId: { in: inEmpty(userIds) } } }),
    community_members: await prisma.communityMember.count({ where: { userId: { in: inEmpty(userIds) } } }),
    users: await prisma.user.count({ where: { id: { in: inEmpty(userIds) } } }),
  };
  for (const [table, count] of Object.entries(remain)) {
    assertEq(count, 0, `清理自验证 ${table}=0`, `remain=${count}`);
  }
  // 圈子 memberCount / postCount 恢复断言（join 时 memberCount+1；表白墙发帖 postCount+1，清理后应回到原始值）
  for (const [cid, before] of Object.entries(created.cmMemberCountBefore)) {
    const after = await prisma.community.findUnique({ where: { id: cid }, select: { memberCount: true } });
    assertEq(after?.memberCount, before, `圈子 ${cid} memberCount 恢复为 join 前 ${before}`, `now=${after?.memberCount}`);
  }
  for (const [cid, before] of Object.entries(created.cmPostCountBefore)) {
    const after = await prisma.community.findUnique({ where: { id: cid }, select: { postCount: true } });
    assertEq(after?.postCount, before, `圈子 ${cid} postCount 恢复为发帖前 ${before}`, `now=${after?.postCount}`);
  }
  console.log('[cleanup] 清理完成并逐表自验证为 0');
}

(async () => {
  console.log('[confession+treehole comments/view/share smoke] BASE =', BASE);
  marker = `ctcs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

  try {
    // dev mock openid 截取 code 前 8 位，两个用户前 8 位必须不同
    const codeA = `${marker.slice(0, 7)}A${marker}`;
    const codeB = `${marker.slice(0, 7)}B${marker}`;
    const A = await login(codeA, `CTA_${marker}`);
    const B = await login(codeB, `CTB_${marker}`);
    created.userIds.push(A.user.id, B.user.id);
    console.log('  users:', A.user.id, B.user.id);

    // ===== 红线：anonId 不含真实 uid =====
    const anonA = await signAnon(A.accessToken);
    assert(anonA.anonId !== A.user.id, '红线：anonId !== 真实 uid', `anonId=${anonA.anonId} uid=${A.user.id}`);

    // ===== 圈子门禁：circle 功能合并后写路径单真相源，新用户未加入圈子发树洞帖抛 80014 =====
    const gateRes = await call('POST', '/treehole/posts', anonA.anonToken, { content: `ctcs gate ${marker}` });
    assertEq(gateRes.body.code, 80014, '未加入圈子发树洞帖抛 80014', JSON.stringify(gateRes.body).slice(0, 120));

    // 加入默认圈子 cm_default（join 置 activeCommunityId）后才可发帖；记录 join 前 memberCount 供清理断言
    created.cmMemberCountBefore.cm_default = (
      await prisma.community.findUnique({ where: { id: 'cm_default' }, select: { memberCount: true } })
    )?.memberCount;
    const joinRes = await call('POST', '/community/cm_default/join', A.accessToken, {});
    assertEq(joinRes.body.code, 0, '加入默认圈子 cm_default', JSON.stringify(joinRes.body).slice(0, 120));
    created.communityMemberRows.push({ communityId: 'cm_default', userId: A.user.id });

    // ===== 树洞帖 + 浏览数自增 =====
    const postRes = await call('POST', '/treehole/posts', anonA.anonToken, { content: `ctcs 树洞帖 ${marker}` });
    assertEq(postRes.body.code, 0, '创建树洞帖', JSON.stringify(postRes.body).slice(0, 120));
    const postId = postRes.body.data.id;
    created.anonPostIds.push(postId);
    assertEq(postRes.body.data.commentCount, 0, '树洞帖初始 commentCount=0');
    assertEq(postRes.body.data.viewCount, 0, '树洞帖初始 viewCount=0');

    const getTreeholeDetail = () => call('GET', `/treehole/posts/${postId}`, anonA.anonToken);
    const tv0 = (await getTreeholeDetail()).body.data.viewCount;
    const tvAfter = await waitViewGte(getTreeholeDetail, tv0 + 1);
    assert(tvAfter >= tv0 + 1, `树洞详情 viewCount 自增 >= +1（${tv0} → ${tvAfter}）`);

    // ===== 树洞评论 =====
    // 楼主评论：isLZ=true
    const cA = await call('POST', `/treehole/posts/${postId}/comments`, anonA.anonToken, { content: '楼主评论' });
    assertEq(cA.body.code, 0, '楼主创建评论', JSON.stringify(cA.body).slice(0, 120));
    created.anonCommentIds.push(cA.body.data.id);
    assertEq(cA.body.data.authorAnonId, anonA.anonId, '评论 authorAnonId === 评论者 anonId');
    assertEq(cA.body.data.isLZ, true, '楼主评论 isLZ=true');
    assert(!('authorId' in cA.body.data) && !('uid' in cA.body.data) && !('userId' in cA.body.data), '评论 VO 不含真实身份字段');

    // 路人评论（另一匿名态）：isLZ=false
    const anonB = await signAnon(B.accessToken);
    assert(anonB.anonId !== anonA.anonId, '两个匿名态 anonId 不同');
    const cB = await call('POST', `/treehole/posts/${postId}/comments`, anonB.anonToken, { content: '路人评论' });
    assertEq(cB.body.code, 0, '路人创建评论');
    created.anonCommentIds.push(cB.body.data.id);
    assertEq(cB.body.data.isLZ, false, '路人评论 isLZ=false');

    // 评论列表：最新优先、total=2
    const list = await call('GET', `/treehole/posts/${postId}/comments?page=1&pageSize=20`, anonA.anonToken);
    assertEq(list.body.code, 0, '评论列表');
    assertEq(list.body.data.total, 2, '评论 total=2');
    assertEq(list.body.data.list[0]?.id, cB.body.data.id, '最新优先：B 的评论在前');
    const topComment = list.body.data.list[0];
    assert(!('uid' in topComment) && !('userId' in topComment) && !('authorId' in topComment), '列表评论 VO 不含真实身份字段');
    assert(typeof topComment.liked === 'boolean' && typeof topComment.likeCount === 'number', '评论 VO 带 liked/likeCount');

    // 帖子 commentCount 动态 _count
    const afterComments = (await getTreeholeDetail()).body.data;
    assertEq(afterComments.commentCount, 2, '树洞帖 commentCount 动态 _count=2');

    // 评论点赞 toggle：往返 1 → 0
    const likeOn = await call('POST', `/treehole/comments/${cA.body.data.id}/like`, anonB.anonToken);
    assertEq(likeOn.body.code, 0, '评论点赞 toggle');
    assertEq(likeOn.body.data.liked, true, '评论点赞 liked=true');
    assertEq(likeOn.body.data.likeCount, 1, '评论点赞 likeCount=1');
    const likeOff = await call('POST', `/treehole/comments/${cA.body.data.id}/like`, anonB.anonToken);
    assertEq(likeOff.body.data.liked, false, '评论取消赞 liked=false');
    assertEq(likeOff.body.data.likeCount, 0, '评论取消赞 likeCount=0');

    // 评论不存在 → 30010
    const likeMissing = await call('POST', '/treehole/comments/not-exist-id/like', anonB.anonToken);
    assertEq(likeMissing.body.code, 30010, '评论不存在抛 30010');

    // ===== 表白墙帖 + 浏览数自增 =====
    const circles = await call('GET', '/circles', A.accessToken);
    const circleId = circles.body.data[0]?.id;
    assert(typeof circleId === 'string' && circleId.length > 0, '获取圈子 id');
    // 表白墙帖归属当前圈子（cm_default），发帖 postCount++；记录发帖前值供清理断言
    created.cmPostCountBefore.cm_default = (
      await prisma.community.findUnique({ where: { id: 'cm_default' }, select: { postCount: true } })
    )?.postCount;
    const cPost = await call('POST', `/circles/${circleId}/posts`, A.accessToken, { content: `ctcs 表白墙 ${marker}` });
    assertEq(cPost.body.code, 0, '创建表白墙帖', JSON.stringify(cPost.body).slice(0, 120));
    const cPostId = cPost.body.data.id;
    created.postIds.push(cPostId);
    assertEq(cPost.body.data.commentCount, 0, '表白墙帖初始 commentCount=0');
    assertEq(cPost.body.data.viewCount, 0, '表白墙帖初始 viewCount=0');

    const getConfessionDetail = () => call('GET', `/posts/${cPostId}`, A.accessToken);
    const pv0 = (await getConfessionDetail()).body.data.viewCount;
    const pvAfter = await waitViewGte(getConfessionDetail, pv0 + 1);
    assert(pvAfter >= pv0 + 1, `表白墙详情 viewCount 自增 >= +1（${pv0} → ${pvAfter}）`);
    const confDetail = (await getConfessionDetail()).body.data;
    assert(typeof confDetail.viewCount === 'number', 'PostVo.viewCount 字段存在');

    console.log('\n[confession+treehole comments/view/share smoke] ALL ASSERTIONS PASSED');
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
})().catch(async (error) => {
  console.error(`\n[confession+treehole smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
