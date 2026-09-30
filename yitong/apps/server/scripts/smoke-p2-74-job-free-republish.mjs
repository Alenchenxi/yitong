/**
 * P2-74 岗位编辑后免付费重新发布 smoke
 * 覆盖契约：
 *   VO publishedAt / canFreeRepublish（GET /job-posts/:id、mine=1 列表）
 *   POST /api/v1/job-posts/:id/publish（免付费直发：expireAt 不变、快照刷新、错误码 40001/10003/40004/50002）
 *   PUT  /api/v1/job-posts/:id（PUBLISHED 编辑回退 PENDING 后 canFreeRepublish=true）
 *   POST /api/v1/payments/job-publish（PENDING+已发布过+有效期内 → 40004 免费重发守卫，先于支付动作）
 *   M3-08 POST /api/v1/job-posts/:id/republish（TAKEN_DOWN 有效期内=true / EXPIRED=false）
 * ⚠️ 绝不对新草稿真实走支付下单；本脚本支付侧仅断言 40004 守卫（在任何支付动作之前抛出）。
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3100 + docker postgres。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3100/api/v1';
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
async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await r.json(); } catch { json = null; }
  return { status: r.status, body: json };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) { console.error('  ✗ FAIL:', msg, 'expected=', e, 'actual=', a); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

const created = {
  userIds: [],
  merchantIds: [],
  jobPostIds: [],
  paymentOrderIds: [],
  notificationIds: [],
  jobViewIds: [],
};
let prismaRef = null;

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理测试数据...');
  // FK 顺序：PaymentOrder -> JobView -> JobApplication -> JobReview -> Notification -> JobPost -> Merchant -> UserRole -> User
  const postIds = created.jobPostIds;
  const uids = created.userIds;

  let r = await prisma.paymentOrder.deleteMany({ where: { jobPostId: { in: postIds } } });
  console.log(`  payment_orders deleteMany: ${r.count}`);
  r = await prisma.jobView.deleteMany({ where: { jobPostId: { in: postIds } } });
  console.log(`  job_views deleteMany: ${r.count}`);
  const apps = await prisma.jobApplication.findMany({ where: { jobPostId: { in: postIds } }, select: { id: true } });
  if (apps.length) {
    r = await prisma.jobReview.deleteMany({ where: { applicationId: { in: apps.map((a) => a.id) } } });
    console.log(`  job_reviews deleteMany: ${r.count}`);
  }
  r = await prisma.jobApplication.deleteMany({ where: { jobPostId: { in: postIds } } });
  console.log(`  job_applications deleteMany: ${r.count}`);
  r = await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  notifications deleteMany: ${r.count}`);
  r = await prisma.jobPost.deleteMany({ where: { id: { in: postIds } } });
  console.log(`  job_posts deleteMany: ${r.count}`);
  r = await prisma.merchant.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  merchants deleteMany: ${r.count}`);
  r = await prisma.userRole.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  user_roles deleteMany: ${r.count}`);
  r = await prisma.user.deleteMany({ where: { id: { in: uids } } });
  console.log(`  users deleteMany: ${r.count}`);

  // 自验证：复查目标表
  const remainPosts = await prisma.jobPost.findMany({ where: { id: { in: postIds } }, select: { id: true } });
  const remainUsers = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true } });
  const remainMerchants = await prisma.merchant.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  const remainOrders = await prisma.paymentOrder.findMany({ where: { jobPostId: { in: postIds } } }, );
  const remainRoles = await prisma.userRole.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  const remainViews = await prisma.jobView.findMany({ where: { jobPostId: { in: postIds } }, select: { id: true } });
  const remainNotifs = await prisma.notification.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  assert(remainPosts.length === 0, `自验证: job_posts 无残留 (剩 ${remainPosts.length})`);
  assert(remainUsers.length === 0, `自验证: users 无残留 (剩 ${remainUsers.length})`);
  assert(remainMerchants.length === 0, `自验证: merchants 无残留 (剩 ${remainMerchants.length})`);
  assert(remainOrders.length === 0, `自验证: payment_orders 无残留 (剩 ${remainOrders.length})`);
  assert(remainRoles.length === 0, `自验证: user_roles 无残留 (剩 ${remainRoles.length})`);
  assert(remainViews.length === 0, `自验证: job_views 无残留 (剩 ${remainViews.length})`);
  assert(remainNotifs.length === 0, `自验证: notifications 无残留 (剩 ${remainNotifs.length})`);
  console.log('[cleanup] 清理完成并自验证通过');
}

(async () => {
  console.log('[p2-74 job-free-republish smoke] base =', BASE);
  const sfx = `p74${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  prismaRef = prisma;

  try {
    // 1) 登录 2 个商家：A（岗位 owner）、B（非 owner 负例）
    const A = await login(`PA${sfx}`, `MerchantA_${sfx}`, 'merchant');
    created.userIds.push(A.user.id);
    await sleep(14000); // wx-login 限流 5/min
    const B = await login(`PB${sfx}`, `MerchantB_${sfx}`, 'merchant');
    created.userIds.push(B.user.id);

    // 写路径（发岗）要求 activeCommunityId（80014）：测试用户直接指向默认圈（仅本脚本自己的行，随 user 删除清理）
    await prisma.user.update({ where: { id: A.user.id }, data: { activeCommunityId: 'cm_default' } });
    await prisma.user.update({ where: { id: B.user.id }, data: { activeCommunityId: 'cm_default' } });

    // 2) 入驻（dev 自动 APPROVED + MERCHANT 角色）
    const regA = await call('POST', '/merchant/register', A.accessToken, {
      shopName: `店铺A_${sfx}`, licenseNo: `LICA${sfx}`, contactPhone: '13800000001',
    });
    assert(regA.body.code === 0, `A 入驻成功 ${JSON.stringify(regA.body).slice(0, 60)}`);
    const mA = await call('GET', '/merchant/profile', A.accessToken);
    created.merchantIds.push(mA.body.data.id);
    const regB = await call('POST', '/merchant/register', B.accessToken, {
      shopName: `店铺B_${sfx}`, licenseNo: `LICB${sfx}`, contactPhone: '13800000002',
    });
    assert(regB.body.code === 0, 'B 入驻成功');
    const mB = await call('GET', '/merchant/profile', B.accessToken);
    created.merchantIds.push(mB.body.data.id);
    // 当前库审核开关为开（register -> PENDING）：测试商家直接置 APPROVED（仅动本脚本自己的行）
    await prisma.merchant.update({ where: { id: mA.body.data.id }, data: { status: 'APPROVED' } });
    await prisma.merchant.update({ where: { id: mB.body.data.id }, data: { status: 'APPROVED' } });

    async function createPost(token, title) {
      const r = await call('POST', '/job-posts', token, {
        title, description: 'P2-74 测试岗位描述（无害文案）', salary: '100/天', location: '校园东门',
        locationLng: 120.1, locationLat: 30.2, // P2-79:坐标语义 GCJ-02,服务端转 BD-09;poiId/city 已删
        category: 'CATERING', settlement: 'DAILY', workDates: ['周六'], workPeriods: ['全天'],
        headcount: 2, questions: ['你的身份'], duration: 'D30',
      });
      assert(r.body.code === 0, `发岗成功: ${title} ${JSON.stringify(r.body).slice(0, 80)}`);
      created.jobPostIds.push(r.body.data.id);
      return r.body.data;
    }

    console.log('\n--- 场景1：新草稿 VO publishedAt=null / canFreeRepublish=false ---');
    const post = await createPost(A.accessToken, `草稿岗_${sfx}`);
    assertEq(post.publishedAt, null, '创建草稿 VO publishedAt=null');
    assertEq(post.canFreeRepublish, false, '创建草稿 VO canFreeRepublish=false');
    const getDraft = await call('GET', `/job-posts/${post.id}`, A.accessToken);
    assertEq(getDraft.body.data.publishedAt, null, 'GET 草稿 VO publishedAt=null');
    assertEq(getDraft.body.data.canFreeRepublish, false, 'GET 草稿 VO canFreeRepublish=false');

    console.log('\n--- 场景2：从未发布过的草稿直接 /publish → 50002 ---');
    const pubDraft = await call('POST', `/job-posts/${post.id}/publish`, A.accessToken);
    assertEq(pubDraft.status, 409, `草稿 /publish HTTP 409 got=${pubDraft.status}`);
    assertEq(pubDraft.body.code, 50002, `草稿 /publish code 50002（从未发布过）got=${pubDraft.body && pubDraft.body.code}`);

    console.log('\n--- 场景3：置为已发布过 → 编辑回退 PENDING → canFreeRepublish=true ---');
    const firstPublishedAt = new Date();
    const origExpireAt = new Date(Date.now() + 30 * 86_400_000);
    await prisma.jobPost.update({
      where: { id: post.id },
      data: { status: 'PUBLISHED', publishedAt: firstPublishedAt, expireAt: origExpireAt },
    });
    const edit1 = await call('PUT', `/job-posts/${post.id}`, A.accessToken, {
      title: `已编辑_${sfx}`, description: 'P2-74 编辑后描述（无害文案）',
    });
    assert(edit1.body.code === 0, `编辑 PUBLISHED 成功 ${JSON.stringify(edit1.body).slice(0, 80)}`);
    assertEq(edit1.body.data.status, 'PENDING', '编辑 PUBLISHED 后回退 PENDING（行为不变）');
    assertEq(edit1.body.data.needsRepublish, true, '编辑返回 needsRepublish=true');
    assertEq(edit1.body.data.canFreeRepublish, true, '编辑返回 VO canFreeRepublish=true');
    assert(!!edit1.body.data.publishedAt, `编辑返回 VO publishedAt 非空=${edit1.body.data.publishedAt}`);
    const getAfterEdit = await call('GET', `/job-posts/${post.id}`, A.accessToken);
    assertEq(getAfterEdit.body.data.canFreeRepublish, true, 'GET 编辑后 VO canFreeRepublish=true');
    assertEq(getAfterEdit.body.data.status, 'PENDING', 'GET 编辑后 status=PENDING');
    const mine = await call('GET', '/job-posts?mine=1&status=PENDING&limit=50', A.accessToken);
    assert(mine.body.code === 0, 'mine=1 列表查询成功');
    const mineItem = (mine.body.data.list || []).find((p) => p.id === post.id);
    assert(!!mineItem, 'mine=1 列表包含该岗位');
    assertEq(mineItem.canFreeRepublish, true, 'mine=1 列表 VO canFreeRepublish=true');
    assert(typeof mineItem.publishedAt === 'string' && mineItem.publishedAt.length > 0, `mine=1 列表 VO publishedAt 字符串=${mineItem.publishedAt}`);

    console.log('\n--- 场景4：PENDING+已发布过+有效期内 支付下单 → 40004 守卫（先于支付动作）---');
    const payTry = await call('POST', '/payments/job-publish', A.accessToken, { jobPostId: post.id, duration: 'D30' });
    assertEq(payTry.status, 409, `支付下单 HTTP 409 got=${payTry.status}`);
    assertEq(payTry.body.code, 40004, `支付下单 code 40004（免费重发守卫）got=${payTry.body && payTry.body.code}`);
    const guardOrders = await prisma.paymentOrder.findMany({ where: { jobPostId: post.id }, select: { id: true, status: true } });
    created.paymentOrderIds.push(...guardOrders.map((o) => o.id));
    assertEq(guardOrders.length, 0, `守卫生效：未落任何 payment_order（剩 ${guardOrders.length}）`);
    assert(!(payTry.body.data && payTry.body.data.virtualPayParams), '响应无 virtualPayParams（未触支付）');

    console.log('\n--- 场景5：/publish 免付费直发 → expireAt 毫秒级不变 / publishedAt 不覆盖 / 快照刷新 ---');
    // 刷新商家联系方式，验证发布时联系快照刷新
    await prisma.merchant.update({
      where: { id: mA.body.data.id },
      data: { contactPhone: '13900000099', contactWechat: `wx_${sfx}` },
    });
    const before = await prisma.jobPost.findUnique({ where: { id: post.id } });
    const pub = await call('POST', `/job-posts/${post.id}/publish`, A.accessToken);
    assert(pub.body.code === 0, `/publish 成功 ${JSON.stringify(pub.body).slice(0, 100)}`);
    assertEq(pub.body.data.status, 'PUBLISHED', '发布后 status=PUBLISHED');
    assertEq(pub.body.data.canFreeRepublish, false, '发布后 VO canFreeRepublish=false（非 PENDING）');
    const after = await prisma.jobPost.findUnique({ where: { id: post.id } });
    assertEq(after.expireAt.getTime(), before.expireAt.getTime(),
      `expireAt 毫秒级不变（before=${before.expireAt.getTime()} after=${after.expireAt.getTime()}）`);
    assertEq(after.publishedAt.getTime(), firstPublishedAt.getTime(),
      `publishedAt 未被覆盖（首次=${firstPublishedAt.getTime()} 当前=${after.publishedAt.getTime()}）`);
    assertEq(pub.body.data.expireAt, origExpireAt.toISOString(), 'VO expireAt 与置入的原值一致');
    assertEq(after.contactPhoneSnapshot, '13900000099', '联系快照 phone 随发布刷新');
    assertEq(after.contactWechatSnapshot, `wx_${sfx}`, '联系快照 wechat 随发布刷新');
    // VO 侧 publishedAt 也应保持首次值
    assertEq(pub.body.data.publishedAt, firstPublishedAt.toISOString(), 'VO publishedAt 保持首次发布时间');

    console.log('\n--- 场景6a：TAKEN_DOWN 有效期内 republish → canFreeRepublish=true（M3-08 行为不变）---');
    const td = await call('POST', `/job-posts/${post.id}/take-down`, A.accessToken);
    assertEq(td.body.code, 0, '主动下架成功');
    const rp1 = await call('POST', `/job-posts/${post.id}/republish`, A.accessToken);
    assertEq(rp1.body.code, 0, 'TAKEN_DOWN republish 成功');
    assertEq(rp1.body.data.status, 'PENDING', 'republish 后 PENDING');
    const getTd = await call('GET', `/job-posts/${post.id}`, A.accessToken);
    assertEq(getTd.body.data.canFreeRepublish, true, 'TAKEN_DOWN 有效期内重置后 canFreeRepublish=true');

    console.log('\n--- 场景6b：EXPIRED republish → canFreeRepublish=false；/publish → 40004 ---');
    await prisma.jobPost.update({
      where: { id: post.id },
      data: { status: 'EXPIRED', expireAt: new Date(Date.now() - 86_400_000) },
    });
    const rp2 = await call('POST', `/job-posts/${post.id}/republish`, A.accessToken);
    assertEq(rp2.body.code, 0, 'EXPIRED republish 成功（M3-08 行为不变）');
    assertEq(rp2.body.data.status, 'PENDING', 'republish 后 PENDING');
    const getExp = await call('GET', `/job-posts/${post.id}`, A.accessToken);
    assertEq(getExp.body.data.canFreeRepublish, false, 'EXPIRED 重置后 canFreeRepublish=false');
    const pubExp = await call('POST', `/job-posts/${post.id}/publish`, A.accessToken);
    assertEq(pubExp.status, 409, `过期岗 /publish HTTP 409 got=${pubExp.status}`);
    assertEq(pubExp.body.code, 40004, `过期岗 /publish code 40004（有效期已过）got=${pubExp.body && pubExp.body.code}`);

    console.log('\n--- 场景6c（额外）：治理下架（moderationAuthority 非空）→ /publish 40004 ---');
    await prisma.jobPost.update({
      where: { id: post.id },
      data: { expireAt: new Date(Date.now() + 30 * 86_400_000), moderationAuthority: 'PLATFORM' },
    });
    const pubMod = await call('POST', `/job-posts/${post.id}/publish`, A.accessToken);
    assertEq(pubMod.status, 409, `治理下架岗 /publish HTTP 409 got=${pubMod.status}`);
    assertEq(pubMod.body.code, 40004, `治理下架岗 /publish code 40004 got=${pubMod.body && pubMod.body.code}`);

    console.log('\n--- 场景7：权限负例（非本人 10003 / 不存在 40001）---');
    const pubB = await call('POST', `/job-posts/${post.id}/publish`, B.accessToken);
    assertEq(pubB.status, 403, `非本人 /publish HTTP 403 got=${pubB.status}`);
    assertEq(pubB.body.code, 10003, `非本人 /publish code 10003 got=${pubB.body && pubB.body.code}`);
    const pubNone = await call('POST', `/job-posts/notexist_${sfx}/publish`, A.accessToken);
    assertEq(pubNone.status, 404, `不存在 /publish HTTP 404 got=${pubNone.status}`);
    assertEq(pubNone.body.code, 40001, `不存在 /publish code 40001 got=${pubNone.body && pubNone.body.code}`);

    // 收集 recordView 产生的 JobView（GET /job-posts/:id 触发）
    const views = await prisma.jobView.findMany({ where: { jobPostId: { in: created.jobPostIds } }, select: { id: true } });
    created.jobViewIds.push(...views.map((v) => v.id));

    console.log('\n[p2-74 job-free-republish smoke] ALL PASSED');
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
})().catch(async (e) => {
  console.error('\n[p2-74 job-free-republish smoke] STOPPED:', e.message);
  if (prismaRef) {
    try { await cleanup(prismaRef); } catch (ce) { console.error('[cleanup] 清理异常:', ce.message); }
    try { await prismaRef.$disconnect(); } catch {}
  }
  process.exit(1);
});
