/**
 * 圈子（Community）+ 广场改造 smoke
 *
 * 覆盖：
 *   - 未加入 → getActiveCommunity 返回 null（加入页门）；读路径兜底默认圈 / 写路径拒 80014
 *   - 创建圈子（category/region/location 校验 + OWNER + memberCount 1 + 置 active）/ 他人加入 + 切换
 *   - 圈子列表 category 过滤 + 圈子搜索 keyword
 *   - 表白墙帖圈属隔离（发帖归属 active community；feed communityId 过滤）
 *   - 树洞帖圈属（anonId -> userId -> active community；x-anon-token 鉴权）
 *   - 岗位圈属（merchant 发岗选圈 + 付费发布；job-posts communityId 过滤）
 *   - 今日上头（近24h 浏览量聚合 + 同人同小时去重 + 超24h 不计）
 *   - Banner（圈子 + 全局占位）
 *   - 圈主 leave 拒 10003；成员 leave 成功
 *   - admin disable/enable 圈子（feed 空 + join 拒 / 恢复）
 *   - 红线断言：anon_post 无真实身份字段；content_views.anon_post 的 viewerKey 为 anonId 非 uid
 *
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3000 + docker postgres。
 * 前置：dev server 运行中（mock 模式）。
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
async function call(method, path, token, body, extraHeaders = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await r.json(); } catch { json = { _raw: await r.text() }; }
  return { status: r.status, body: json };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

const created = {
  userIds: [],
  communityIds: [],
  postIds: [],
  anonPostIds: [],
  jobPostIds: [],
  merchantIds: [],
  paymentOrderIds: [],
};

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理测试数据...');
  if (created.postIds.length) {
    const postIds = created.postIds;
    let r = await prisma.comment.deleteMany({ where: { postId: { in: postIds } } });
    console.log(`  comments deleteMany: ${r.count}`);
    r = await prisma.postLike.deleteMany({ where: { postId: { in: postIds } } });
    console.log(`  post_likes deleteMany: ${r.count}`);
    r = await prisma.contentView.deleteMany({ where: { targetId: { in: postIds } } });
    console.log(`  content_views(post) deleteMany: ${r.count}`);
    r = await prisma.post.deleteMany({ where: { id: { in: postIds } } });
    console.log(`  posts deleteMany: ${r.count}`);
  }
  if (created.anonPostIds.length) {
    let r = await prisma.anonPostLike.deleteMany({ where: { postId: { in: created.anonPostIds } } });
    console.log(`  anon_post_likes deleteMany: ${r.count}`);
    r = await prisma.contentView.deleteMany({ where: { targetId: { in: created.anonPostIds } } });
    console.log(`  content_views(anon_post) deleteMany: ${r.count}`);
    r = await prisma.anonymousPost.deleteMany({ where: { id: { in: created.anonPostIds } } });
    console.log(`  anonymous_posts deleteMany: ${r.count}`);
  }
  if (created.jobPostIds.length) {
    const ids = created.jobPostIds;
    let r = await prisma.paymentOrder.deleteMany({ where: { jobPostId: { in: ids } } });
    console.log(`  payment_orders deleteMany: ${r.count}`);
    r = await prisma.jobApplication.deleteMany({ where: { jobPostId: { in: ids } } });
    console.log(`  job_applications deleteMany: ${r.count}`);
    r = await prisma.jobView.deleteMany({ where: { jobPostId: { in: ids } } });
    console.log(`  job_views deleteMany: ${r.count}`);
    r = await prisma.jobImpression.deleteMany({ where: { jobPostId: { in: ids } } });
    console.log(`  job_impressions deleteMany: ${r.count}`);
    r = await prisma.jobPost.deleteMany({ where: { id: { in: ids } } });
    console.log(`  job_posts deleteMany: ${r.count}`);
  }
  if (created.communityIds.length) {
    const cids = created.communityIds;
    let r = await prisma.communityMember.deleteMany({ where: { communityId: { in: cids } } });
    console.log(`  community_members deleteMany: ${r.count}`);
    r = await prisma.banner.deleteMany({ where: { communityId: { in: cids } } });
    console.log(`  banners deleteMany: ${r.count}`);
    r = await prisma.community.deleteMany({ where: { id: { in: cids } } });
    console.log(`  communities deleteMany: ${r.count}`);
  }
  // merchant 必须先于 user 删除（merchant.userId 无级联，漏删会在 users 删除后遗留孤儿 merchant）
  if (created.merchantIds.length) {
    let r = await prisma.merchant.deleteMany({ where: { id: { in: created.merchantIds } } });
    console.log(`  merchants deleteMany: ${r.count}`);
  }
  if (created.userIds.length) {
    const uids = created.userIds;
    let r = await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
    console.log(`  notifications deleteMany: ${r.count}`);
    r = await prisma.anonymousProfile.deleteMany({ where: { userId: { in: uids } } });
    console.log(`  anonymous_profiles deleteMany: ${r.count}`);
    r = await prisma.userRole.deleteMany({ where: { userId: { in: uids } } });
    console.log(`  user_roles deleteMany: ${r.count}`);
    r = await prisma.user.deleteMany({ where: { id: { in: uids } } });
    console.log(`  users deleteMany: ${r.count}`);
  }
  // 自验证
  const leftover = await prisma.community.count({ where: { id: { in: created.communityIds } } });
  assert(leftover === 0, '自验证：测试圈子已清空');
  const merchantLeft = await prisma.merchant.count({ where: { id: { in: created.merchantIds } } });
  assert(merchantLeft === 0, '自验证：测试商家已清空');
  console.log('[cleanup] 清理完成');
}

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  console.log('[smoke-community-plaza] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  let failed = false;

  try {
    // ============ 登录用户 A / B / M（merchant） ============
    const A = await login(`cm-A-${sfx}`, `Cm_A_${sfx}`, 'user');
    created.userIds.push(A.user.id);
    await sleep(14000); // 登录限流 5/min
    const B = await login(`cm-B-${sfx}`, `Cm_B_${sfx}`, 'user');
    created.userIds.push(B.user.id);
    await sleep(14000);
    const M = await login(`cm-M-${sfx}`, `Cm_M_${sfx}`, 'merchant');
    created.userIds.push(M.user.id);
    console.log('  A=', A.user.id, 'B=', B.user.id, 'M=', M.user.id);

    // ============ 1. 未加入圈子 → active=null（加入页门）+ 读路径兜底 + 写路径拒 ============
    const act = await call('GET', '/community/active', A.accessToken);
    assert(act.body.code === 0 && act.body.data === null, '未加入圈子时 getActiveCommunity 返回 null');
    const mine1 = await call('GET', '/community/mine', A.accessToken);
    assert(mine1.body.data.activeId === null && mine1.body.data.list.length === 0, 'mine.activeId = null 且无圈子');
    // 读路径缺省 communityId → 兜底默认圈 cm_default，不抛错
    const feedFallback = await call('GET', '/posts/feed?sort=latest&limit=20', A.accessToken);
    assert(feedFallback.body.code === 0 && Array.isArray(feedFallback.body.data.list), '读路径 feed 缺省兜底默认圈（不抛错）');
    // 写路径（发帖）未加入 → 80014 请先加入圈子
    const someCircle = (await call('GET', '/circles', A.accessToken)).body.data[0];
    const writeReject = await call('POST', `/circles/${someCircle.id}/posts`, A.accessToken, { content: `未加入发帖_${sfx}` });
    assert(writeReject.status === 403 && writeReject.body.code === 80014, '未加入圈子发帖 → 80014 请先加入圈子');

    // ============ 2. A 创建圈子（category/region/location）→ OWNER + memberCount 1 + 置 active ============
    const cName = `测试圈${sfx}`;
    const badCat = await call('POST', '/community', A.accessToken, { name: `${cName}_bad`, category: '非法分类', region: '杭州', location: '某地' });
    assert(badCat.status === 400, '非法 category 创建 → 400');
    const c = await call('POST', '/community', A.accessToken, { name: cName, category: '校园', region: '杭州', location: '浙大玉泉校区' });
    assert(c.body.code === 0 && c.body.data.isMember && c.body.data.myRole === 'OWNER', 'A 建圈 → OWNER');
    assert(c.body.data.memberCount === 1, '建圈 memberCount = 1');
    assert(c.body.data.category === '校园' && c.body.data.region === '杭州' && c.body.data.location === '浙大玉泉校区', '建圈写入 category/region/location');
    const cid = c.body.data.id;
    created.communityIds.push(cid);
    const act2 = await call('GET', '/community/active', A.accessToken);
    assert(act2.body.data.id === cid, '建圈后 active = 新圈');
    // 圈子列表 category 过滤
    const listCampus = await call('GET', '/community/list?category=校园', A.accessToken);
    assert((listCampus.body.data || []).some((x) => x.id === cid), 'list?category=校园 含新圈');
    const listPart = await call('GET', '/community/list?category=兼职', A.accessToken);
    assert(!(listPart.body.data || []).some((x) => x.id === cid), 'list?category=兼职 不含新圈（过滤生效）');
    // 圈子搜索 keyword
    const sHit = await call('GET', `/community/search?keyword=${encodeURIComponent(cName)}`, A.accessToken);
    assert((sHit.body.data || []).some((x) => x.id === cid), 'search keyword 命中新圈');
    const sMiss = await call('GET', '/community/search?keyword=不存在的圈子xyz', A.accessToken);
    assert(sMiss.body.code === 0 && (sMiss.body.data || []).length === 0, 'search 无关 keyword 空结果');

    // ============ 3. B 加入 + 切换 ============
    const listB = await call('GET', '/community/list', B.accessToken);
    const found = (listB.body.data || []).find((x) => x.id === cid);
    assert(!!found && found.isMember === false, 'B 视角：新圈可见且未加入');
    const joinB = await call('POST', `/community/${cid}/join`, B.accessToken);
    assert(joinB.body.code === 0, 'B 加入成功');
    const actB = await call('GET', '/community/active', B.accessToken);
    assert(actB.body.data.id === cid, '加入后 B 的 active = 新圈');
    const detailB = await call('GET', `/community/${cid}`, B.accessToken);
    assert(detailB.body.data.memberCount === 2, 'memberCount = 2');

    // 重复加入 → 80012
    const joinB2 = await call('POST', `/community/${cid}/join`, B.accessToken);
    assert(joinB2.status === 400, '重复加入 → 400');

    // ============ 4. 表白墙帖圈属隔离 ============
    const circle = (await call('GET', '/circles', A.accessToken)).body.data[0];
    const post = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, { content: `圈子帖_${sfx}` });
    assert(post.body.code === 0, 'A 发帖成功');
    const pid = post.body.data.id;
    created.postIds.push(pid);
    // A 的 active = cid → 帖子圈属 cid
    const feedNew = await call('GET', `/posts/feed?sort=latest&communityId=${cid}&limit=20`, A.accessToken);
    assert((feedNew.body.data.list || []).some((p) => p.id === pid), '新圈 feed 含该帖');
    const feedDefault = await call('GET', '/posts/feed?sort=latest&communityId=cm_default&limit=50', A.accessToken);
    assert(!(feedDefault.body.data.list || []).some((p) => p.id === pid), 'cm_default feed 不含该帖（圈属隔离）');

    // ============ 5. 树洞帖圈属（x-anon-token） ============
    const anonA = await call('POST', '/treehole/anonymous-token', A.accessToken, {});
    assert(anonA.body.code === 0, 'A 签发 anonToken');
    const anonPost = await call(
      'POST', '/treehole/posts', null,
      { content: `树洞帖_${sfx}`, mood: '开心' },
      { authorization: `Bearer ${anonA.body.data.anonToken}` },
    );
    assert(anonPost.body.code === 0, 'A 发树洞帖');
    const anonPid = anonPost.body.data.id;
    created.anonPostIds.push(anonPid);
    // 树洞帖归属 A 的 active（= cid）
    const anonFeed = await call(
      'GET', `/treehole/posts?sort=latest&communityId=${cid}&limit=20`, null,
      null, { authorization: `Bearer ${anonA.body.data.anonToken}` },
    );
    assert((anonFeed.body.data.list || []).some((p) => p.id === anonPid), '树洞帖出现在 cid 树洞 tab');
    const anonFeedDefault = await call(
      'GET', '/treehole/posts?sort=latest&communityId=cm_default&limit=50', null,
      null, { authorization: `Bearer ${anonA.body.data.anonToken}` },
    );
    assert(!(anonFeedDefault.body.data.list || []).some((p) => p.id === anonPid), '树洞帖不在 cm_default（圈属隔离）');

    // ============ 6. 岗位圈属（merchant 发岗选圈 + 付费发布） ============
    const regM = await call('POST', '/merchant/register', M.accessToken, {
      shopName: `店铺M_${sfx}`, licenseNo: `LICM${sfx}`, contactPhone: '13800000003',
    });
    assert(regM.body.code === 0, 'M 入驻成功');
    const mProf = await call('GET', '/merchant/profile', M.accessToken);
    created.merchantIds.push(mProf.body.data.id);
    const job = await call('POST', '/job-posts', M.accessToken, {
      title: `圈子岗_${sfx}`, description: '圈子 smoke 岗位', salary: '100/天', location: '校',
      category: 'CATERING', settlement: 'DAILY', workDates: ['周六'], workPeriods: ['全天'],
      headcount: 2, duration: 'D30', communityId: cid,
      locationPoiId: 'poi_x', locationLng: 120.1, locationLat: 30.2, locationCity: '杭州',
    });
    assert(job.body.code === 0, 'M 发岗（选圈 cid）');
    const jobId = job.body.data.id;
    created.jobPostIds.push(jobId);
    const pay = await call('POST', '/payments/job-publish', M.accessToken, { jobPostId: jobId, duration: 'D30' });
    assert(pay.body.code === 0, 'M 付费发布成功');
    const jobFeed = await call('GET', `/job-posts?communityId=${cid}&limit=20`, A.accessToken);
    assert((jobFeed.body.data.list || []).some((p) => p.id === jobId), 'cid 兼职 tab 含该岗');
    const jobFeedDefault = await call('GET', '/job-posts?communityId=cm_default&limit=50', A.accessToken);
    assert(!(jobFeedDefault.body.data.list || []).some((p) => p.id === jobId), 'cm_default 兼职 tab 不含该岗（圈属隔离）');

    // ============ 7. 今日上头：近24h 浏览量 + 去重 ============
    // 先看 pid（表白墙帖）浏览量 0 → 不在今日上头
    const hit0 = await call('GET', `/square/today-hit?communityId=${cid}&limit=10`, A.accessToken);
    assert(!(hit0.body.data.list || []).some((x) => x.data.id === pid), '初始 pid 不在今日上头');
    // 浏览 pid 两次（同人同小时）→ ContentView 仅 1 行 → 今日上头 viewCount = 1
    await call('GET', `/posts/${pid}`, A.accessToken);
    await call('GET', `/posts/${pid}`, A.accessToken);
    const hit1 = await call('GET', `/square/today-hit?communityId=${cid}&limit=10`, A.accessToken);
    const hitItem = (hit1.body.data.list || []).find((x) => x.data.id === pid);
    assert(!!hitItem && hitItem.viewCount === 1, '同人同小时浏览 2 次 → viewCount=1（去重）');
    // 树洞帖浏览：viewer 用 anonId
    const anonDetail = await call(
      'GET', `/treehole/posts/${anonPid}`, null, null,
      { authorization: `Bearer ${anonA.body.data.anonToken}` },
    );
    assert(anonDetail.body.code === 0, 'A 浏览树洞帖详情');
    const hit2 = await call('GET', `/square/today-hit?communityId=${cid}&limit=10`, A.accessToken);
    const hitAnon = (hit2.body.data.list || []).find((x) => x.data.id === anonPid);
    assert(!!hitAnon && hitAnon.viewCount === 1, '今日上头含树洞帖 viewCount=1');

    // 红线：今日上头 anon_post 无真实身份字段
    for (const item of hit2.body.data.list || []) {
      if (item.kind === 'anon_post') {
        assert(!('authorId' in item.data) && !('userId' in item.data) && !('authorNickname' in item.data), '今日上头 anon_post 无真实身份字段');
      }
    }
    // 红线：content_views.anon_post 的 viewerKey 必须是 anonId（非真实 uid）
    const cv = await prisma.contentView.findFirst({ where: { targetType: 'anon_post', targetId: anonPid } });
    assert(!!cv && cv.viewerKey === anonA.body.data.anonId, 'content_views.anon_post viewerKey = anonId（红线）');
    assert(cv && !created.userIds.includes(cv.viewerKey), 'content_views.anon_post viewerKey 非真实 uid');

    // ============ 8. Banner（全局占位） ============
    const banners = await call('GET', `/square/banners?communityId=${cid}`, A.accessToken);
    assert(Array.isArray(banners.body.data) && banners.body.data.length >= 1, 'Banner 返回占位（全局）');

    // ============ 9. 圈主 leave 拒；成员 leave 成功 ============
    const ownerLeave = await call('POST', `/community/${cid}/leave`, A.accessToken);
    assert(ownerLeave.status === 403, '圈主 leave → 403');
    const bLeave = await call('POST', `/community/${cid}/leave`, B.accessToken);
    assert(bLeave.body.code === 0, 'B leave 成功');
    const detailAfter = await call('GET', `/community/${cid}`, A.accessToken);
    assert(detailAfter.body.data.memberCount === 1, 'leave 后 memberCount = 1');
    const actB2 = await call('GET', '/community/active', B.accessToken);
    assert(actB2.body.data === null, 'B leave 后 active 回 null（不再自动回默认圈）');
    const mineB2 = await call('GET', '/community/mine', B.accessToken);
    assert(mineB2.body.data.activeId === null && !(mineB2.body.data.list || []).some((x) => x.id === cid), 'B leave 后 mine 无该圈且 activeId=null');

    // ============ 10. admin disable/enable ============
    const adm = await login('admin', 'Cm_Admin', 'admin');
    created.userIds.push(adm.user.id);
    const dis = await call('POST', `/admin/communities/${cid}/disable`, adm.accessToken);
    assert(dis.body.code === 0, 'admin disable 圈子');
    const joinAfterDis = await call('POST', `/community/${cid}/join`, B.accessToken);
    assert(joinAfterDis.status === 400, 'disable 后加入 → 400');
    const feedAfterDis = await call('GET', `/posts/feed?sort=latest&communityId=${cid}&limit=20`, A.accessToken);
    assert(feedAfterDis.body.data.list.length === 0, 'disable 后圈子 feed 空');
    const en = await call('POST', `/admin/communities/${cid}/enable`, adm.accessToken);
    assert(en.body.code === 0, 'admin enable 圈子');
    const joinAfterEn = await call('POST', `/community/${cid}/join`, B.accessToken);
    assert(joinAfterEn.body.code === 0, 'enable 后加入恢复');

    console.log('\n=== ALL PASSED ===');
  } catch (e) {
    failed = true;
    console.error('\n[FAIL]', e.message);
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
