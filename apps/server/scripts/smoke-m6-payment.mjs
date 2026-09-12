/**
 * M6 支付与订单（dev mock）独立 smoke
 *
 * 覆盖契约（dev mock，逐项断言）：
 * 1. job-publish mock：创建 PENDING 岗位 -> 付费发布 -> status=PAID + wxPayParams=null + jobPostStatus=PUBLISHED；DB 复查
 * 2. refund mock：对 PAID 订单退款 -> status=REFUNDED；DB 复查 jobPost=TAKEN_DOWN + refundStatus=SUCCESS
 * 3. getOrder：GET /payments/:orderId -> status=REFUNDED
 * 4. sync dev 本地：POST /payments/:orderId/sync -> 含 message（dev 模式仅返回本地状态）+ status=REFUNDED
 * 5. 权限：另一 user token GET /payments/:orderId -> 10003 / 403
 * 6. REFUNDING 枚举存在：DB pg_enum 含 REFUNDING + 代码层 PayStatus.REFUNDING
 * 7. isReady=false：契约点1 wxPayParams=null 即证走 mock 路径（未调真实微信）
 *
 * 环境适配：当前 .env 配了 WX_USER_APPID + WX_USER_SECRET，auth.code2session 走真实微信 API，
 * 无法用假 code 登录。故本脚本用 prisma 直接创建测试 user + user_role，并用 Node crypto 手动
 * 签发 HS256 JWT（secret 从 .env 读 JWT_SECRET），绕过微信登录。支付侧 WX_PAY_* 凭证不齐，
 * WxPayService.isReady()=false，PaymentService 走 dev mock 路径（本次测试目标）。
 *
 * 用法：
 *   cd G:/副业/仿校园小程序开发/project/apps/server
 *   node scripts/smoke-m6-payment.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/yitong?schema=public';
const SERVER_DIR = process.env.SERVER_DIR || 'G:/副业/仿校园小程序开发/project/apps/server';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 从 .env 读 JWT_SECRET（不打印值），与 auth.module JwtModule 同源
function readJwtSecret() {
  const envPath = path.join(SERVER_DIR, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(/^JWT_SECRET=(.*)$/m);
  if (!m) return 'dev-secret-change-me';
  let val = m[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// 手动签 HS256 JWT，兼容 @nestjs/jwt JwtService.verifyAsync
function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7200 }; // 2h，与 ACCESS_EXPIRES 一致
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(fullPayload))}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

async function call(method, pathUrl, token, body) {
  const response = await fetch(`${BASE}${pathUrl}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // 保留非 JSON 响应，断言时报告 status。
  }
  return { status: response.status, body: json };
}

function assert(condition, message, evidence = '') {
  if (!condition) {
    const suffix = evidence ? ` | ${evidence}` : '';
    console.error(`  ✗ ${message}${suffix}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}${evidence ? ` | ${evidence}` : ''}`);
}

function assertEq(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  assert(actualText === expectedText, message, `expected=${expectedText} actual=${actualText}`);
}

const created = {
  userIds: [],
  merchantIds: [],
  jobPostIds: [],
  confessionPostIds: [], // 契约点9-11：表白墙帖子（posts 表，带 M6_BOOST_ marker）
  paymentOrderIds: [],
};
let prismaRef = null;
let marker = '';
let mockOpenidPrefixes = [];
let selfCreatedPricing = false; // 是否由本脚本新建 PricingConfig.D30
let jwtSecret = '';

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理本 smoke 创建的数据...');

  // 通过 marker / openid 前缀重新发现已创建的 id，避免中途断言失败残留。
  const markerUsers = await prisma.user.findMany({
    where: mockOpenidPrefixes.length > 0
      ? { OR: mockOpenidPrefixes.map((prefix) => ({ openid: { startsWith: prefix } })) }
      : { id: { in: [] } },
    select: { id: true },
  });
  const userIds = [...new Set([...created.userIds, ...markerUsers.map((row) => row.id)])];

  const markerMerchants = await prisma.merchant.findMany({
    where: userIds.length > 0 ? { userId: { in: userIds } } : { id: { in: [] } },
    select: { id: true },
  });
  const merchantIds = [...new Set([...created.merchantIds, ...markerMerchants.map((row) => row.id)])];

  const markerPosts = await prisma.jobPost.findMany({
    where: {
      OR: [
        ...(merchantIds.length > 0 ? [{ merchantId: { in: merchantIds } }] : []),
        { title: { startsWith: `M6_${marker}` } },
      ],
    },
    select: { id: true },
  });
  const postIds = [...new Set([...created.jobPostIds, ...markerPosts.map((row) => row.id)])];

  // 契约点9-11：表白墙帖子按 content marker 重新发现
  const markerConfessionPosts = await prisma.post.findMany({
    where: { content: { startsWith: `M6_BOOST_${marker}` } },
    select: { id: true },
  });
  const confessionPostIds = [
    ...new Set([...created.confessionPostIds, ...markerConfessionPosts.map((row) => row.id)]),
  ];

  const markerOrders = await prisma.paymentOrder.findMany({
    where: {
      OR: [
        ...(postIds.length > 0 ? [{ jobPostId: { in: postIds } }] : []),
        ...(confessionPostIds.length > 0 ? [{ postId: { in: confessionPostIds } }] : []),
        ...(created.paymentOrderIds.length > 0 ? [{ id: { in: created.paymentOrderIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const orderIds = [...new Set([...created.paymentOrderIds, ...markerOrders.map((row) => row.id)])];

  const deleteMany = async (label, operation) => {
    const result = await operation();
    console.log(`  ${label}: ${result.count}`);
    return result.count;
  };

  // 子表先删；按 FK 反向顺序。
  await deleteMany('payment_orders', () =>
    orderIds.length > 0
      ? prisma.paymentOrder.deleteMany({ where: { id: { in: orderIds } } })
      : prisma.paymentOrder.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('job_views', () =>
    postIds.length > 0
      ? prisma.jobView.deleteMany({ where: { jobPostId: { in: postIds } } })
      : prisma.jobView.deleteMany({ where: { jobPostId: { in: [] } } }),
  );
  await deleteMany('job_applications', () =>
    postIds.length > 0
      ? prisma.jobApplication.deleteMany({ where: { jobPostId: { in: postIds } } })
      : prisma.jobApplication.deleteMany({ where: { jobPostId: { in: [] } } }),
  );
  await deleteMany('notifications', () =>
    userIds.length > 0
      ? prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.notification.deleteMany({ where: { userId: { in: [] } } }),
  );
  await deleteMany('job_posts', () =>
    postIds.length > 0
      ? prisma.jobPost.deleteMany({ where: { id: { in: postIds } } })
      : prisma.jobPost.deleteMany({ where: { id: { in: [] } } }),
  );
  // 契约点9-11：表白墙帖子。发帖时服务端对 cm_default 做了 postCount++，删帖前先归还。
  if (confessionPostIds.length > 0) {
    const dec = await prisma.community.updateMany({
      where: { id: 'cm_default', postCount: { gte: confessionPostIds.length } },
      data: { postCount: { decrement: confessionPostIds.length } },
    });
    console.log(`  community postCount 归还 (cm_default): 归还次数=${dec.count}，应归还=${confessionPostIds.length}`);
  }
  await deleteMany('posts', () =>
    confessionPostIds.length > 0
      ? prisma.post.deleteMany({ where: { id: { in: confessionPostIds } } })
      : prisma.post.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('merchants', () =>
    userIds.length > 0
      ? prisma.merchant.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.merchant.deleteMany({ where: { userId: { in: [] } } }),
  );
  await deleteMany('user_roles', () =>
    userIds.length > 0
      ? prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.userRole.deleteMany({ where: { userId: { in: [] } } }),
  );
  await deleteMany('users', () =>
    userIds.length > 0
      ? prisma.user.deleteMany({ where: { id: { in: userIds } } })
      : prisma.user.deleteMany({ where: { id: { in: [] } } }),
  );

  // 若本脚本新建了 PricingConfig.D30，删除（还原 seed 前状态）
  if (selfCreatedPricing) {
    const delPricing = await prisma.pricingConfig.deleteMany({ where: { duration: 'D30' } });
    console.log(`  pricing_config D30 (self-created): ${delPricing.count}`);
  }

  // 逐表自验证：marker 查询确认无测试残留
  const remain = {
    users: mockOpenidPrefixes.length > 0
      ? await prisma.user.count({ where: { OR: mockOpenidPrefixes.map((prefix) => ({ openid: { startsWith: prefix } })) } })
      : 0,
    merchants: await prisma.merchant.count({ where: { userId: { in: userIds } } }),
    posts: await prisma.jobPost.count({ where: postIds.length > 0 ? { id: { in: postIds } } : { id: { in: [] } } }),
    confessionPosts: await prisma.post.count({
      where: confessionPostIds.length > 0 ? { id: { in: confessionPostIds } } : { id: { in: [] } },
    }),
    orders: await prisma.paymentOrder.count({ where: orderIds.length > 0 ? { id: { in: orderIds } } : { id: { in: [] } } }),
    roles: await prisma.userRole.count({ where: { userId: { in: userIds } } }),
  };
  for (const [table, count] of Object.entries(remain)) {
    assert(count === 0, `清理自验证 ${table}=0`, `remain=${count}`);
  }
  console.log('[cleanup] 清理完成并逐表自验证为 0');
}

// 直接用 prisma 创建测试 user + user_role，并签发 JWT（绕过真实微信登录）
async function createTestUser(prisma, openid, nickname, role) {
  const user = await prisma.user.upsert({
    where: { openid },
    create: { openid, unionid: null, nickname, avatarUrl: null },
    update: { nickname },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    update: {},
    create: { userId: user.id, role },
  });
  const token = signJwt({ uid: user.id, role, openid, type: 'access' }, jwtSecret);
  return { user, token };
}

(async () => {
  console.log('[m6 payment smoke] BASE =', BASE);
  marker = `m6_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  jwtSecret = readJwtSecret();
  const { PrismaClient, PayStatus } = await import('@prisma/client');
  prismaRef = new PrismaClient({ datasources: { db: { url: DB } } });

  try {
    // 两个测试用户：merchant + student（用于权限测试）。openid 唯一且带 marker，便于清理。
    const merchantOpenid = `mock_m6m_${marker}`;
    const studentOpenid = `mock_m6s_${marker}`;
    mockOpenidPrefixes = [merchantOpenid, studentOpenid];

    const { user: merchantUser, token: merchantToken } = await createTestUser(
      prismaRef, merchantOpenid, `M6商家_${marker}`, 'MERCHANT',
    );
    created.userIds.push(merchantUser.id);
    console.log(`  创建测试商家用户 uid=${merchantUser.id} openid=${merchantOpenid}`);

    // 2026-08-10 起发岗写路径要求用户 activeCommunityId 指向 ACTIVE 圈子（80014，不再惰性进默认圈）。
    // 夹具：加入 seed 默认圈 cm_default 并设为活跃圈；成员表随用户级联删除，无需单独清理。
    const defaultCommunity = await prismaRef.community.findUnique({
      where: { id: 'cm_default' },
      select: { id: true, status: true, deletedAt: true },
    });
    assert(
      defaultCommunity && defaultCommunity.status === 'ACTIVE' && !defaultCommunity.deletedAt,
      'seed 默认圈 cm_default 存在且 ACTIVE',
      JSON.stringify(defaultCommunity),
    );
    await prismaRef.communityMember.upsert({
      where: { communityId_userId: { communityId: defaultCommunity.id, userId: merchantUser.id } },
      update: {},
      create: { communityId: defaultCommunity.id, userId: merchantUser.id },
    });
    await prismaRef.user.update({
      where: { id: merchantUser.id },
      data: { activeCommunityId: defaultCommunity.id },
    });
    console.log(`  商家用户已加入默认圈 cm_default 并设为活跃圈`);

    const { user: studentUser, token: studentToken } = await createTestUser(
      prismaRef, studentOpenid, `M6学生_${marker}`, 'USER',
    );
    created.userIds.push(studentUser.id);
    console.log(`  创建测试学生用户 uid=${studentUser.id} openid=${studentOpenid}`);

    // 验证 JWT 可用：调一个受保护接口 GET /auth/me（若 401 说明 JWT 签发有误）
    const meResp = await call('GET', '/auth/me', merchantToken);
    assert(meResp.status === 200 && meResp.body?.code === 0, 'JWT 签发可用：GET /auth/me 成功', JSON.stringify(meResp.body));

    // 商家入驻（seed 默认 merchant.need_review=true，注册落 PENDING；夹具直接置 APPROVED，等价旧 dev 自动过审）
    const registration = await call('POST', '/merchant/register', merchantToken, {
      shopName: `M6店铺_${marker}`,
      licenseNo: `M6LIC_${marker}`,
      contactPhone: '13800000006',
    });
    assert(registration.body?.code === 0, '创建并注册测试商家成功', JSON.stringify(registration.body));
    const profile = await call('GET', '/merchant/profile', merchantToken);
    assert(profile.body?.code === 0, '读取测试商家 profile 成功');
    const merchantId = profile.body.data.id;
    created.merchantIds.push(merchantId);
    await prismaRef.merchant.update({ where: { id: merchantId }, data: { status: 'APPROVED' } });
    const profileApproved = await call('GET', '/merchant/profile', merchantToken);
    assertEq(profileApproved.body?.data?.status, 'APPROVED', '测试商家 dev 状态为 APPROVED');

    // 确保 PricingConfig.D30 存在（seed 应已建；缺则自建，测完删除）
    let pricingD30 = await prismaRef.pricingConfig.findUnique({ where: { duration: 'D30' } });
    if (!pricingD30) {
      pricingD30 = await prismaRef.pricingConfig.create({ data: { duration: 'D30', price: 90 } });
      selfCreatedPricing = true;
      console.log(`  (PricingConfig.D30 缺失，已自建 price=90，测完将删除)`);
    } else {
      console.log(`  (PricingConfig.D30 已存在 price=${pricingD30.price.toString()}，不改动)`);
    }

    // 创建 PENDING 岗位（2026-08-10 起工作地点强制地图选点四件套）
    const createdPost = await call('POST', '/job-posts', merchantToken, {
      title: `M6_测试岗位_${marker}`,
      description: 'M6 smoke 测试岗位描述',
      salary: '100/天',
      location: 'M6 测试地点',
      locationPoiId: `B0FFG9M6SMK_${marker}`,
      locationLng: 116.397428,
      locationLat: 39.90923,
      locationCity: '北京',
      category: 'CATERING',
      settlement: 'DAILY',
      workDates: ['周六'],
      workPeriods: ['全天'],
      headcount: 10,
      questions: [],
      duration: 'D30',
    });
    assert(createdPost.body?.code === 0, '创建 PENDING 测试岗位成功', JSON.stringify(createdPost.body));
    const postId = createdPost.body.data.id;
    created.jobPostIds.push(postId);
    const postBefore = await prismaRef.jobPost.findUnique({ where: { id: postId }, select: { status: true } });
    assertEq(postBefore?.status, 'PENDING', '创建后岗位状态为 PENDING');

    // ===== 契约点1：job-publish mock =====
    console.log('\n[契约点1] job-publish dev mock');
    const publishResp = await call('POST', '/payments/job-publish', merchantToken, {
      jobPostId: postId,
      duration: 'D30',
    });
    assert(publishResp.body?.code === 0, '契约点1：付费发布接口成功', JSON.stringify(publishResp.body));
    const pd = publishResp.body.data;
    assertEq(pd.status, 'PAID', '契约点1：返回 status=PAID');
    assertEq(pd.wxPayParams, null, '契约点1：返回 wxPayParams=null（mock 路径，未调真实微信）');
    assertEq(pd.virtualPayParams, null, '契约点1：返回 virtualPayParams=null（mock 路径，未调真实虚拟支付）');
    assertEq(pd.jobPostStatus, 'PUBLISHED', '契约点1：返回 jobPostStatus=PUBLISHED');
    const orderId = pd.orderId;
    assert(typeof orderId === 'string' && orderId.length > 0, '契约点1：返回 orderId 非空');
    created.paymentOrderIds.push(orderId);
    // DB 复查
    const orderAfterPublish = await prismaRef.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true, amount: true, duration: true, channel: true },
    });
    assertEq(orderAfterPublish?.channel, 'XPAY', '契约点1：DB paymentOrder.channel=XPAY（岗位发布走虚拟支付通道）');
    const postAfterPublish = await prismaRef.jobPost.findUnique({
      where: { id: postId },
      select: { status: true, expireAt: true },
    });
    assertEq(orderAfterPublish?.status, 'PAID', '契约点1：DB paymentOrder.status=PAID');
    assertEq(postAfterPublish?.status, 'PUBLISHED', '契约点1：DB jobPost.status=PUBLISHED');
    assert(postAfterPublish?.expireAt !== null, '契约点1：DB jobPost.expireAt 已置位');

    // ===== 契约点7：isReady=false 间接证明 =====
    console.log('\n[契约点7] isReady=false 间接证明');
    assert(pd.wxPayParams === null, '契约点7：wxPayParams=null 证明走 dev mock 路径（isReady=false）');
    assert(pd.virtualPayParams === null, '契约点7：virtualPayParams=null 证明虚拟支付同样走 mock（WX_XPAY 凭证未配置）');

    // ===== 契约点8：平台管理员（ADMIN 角色）免支付发岗 =====
    console.log('\n[契约点8] 平台管理员免支付发岗');
    // 夹具：ADMIN 角色用户 + APPROVED 商家（与商家用户同一套注册/过审流程，证明"正常走流程"）
    const adminOpenid = `mock_m6a_${marker}`;
    mockOpenidPrefixes.push(adminOpenid);
    const { user: adminUser, token: adminToken } = await createTestUser(
      prismaRef, adminOpenid, `M6平台管理员_${marker}`, 'ADMIN',
    );
    created.userIds.push(adminUser.id);
    await prismaRef.communityMember.upsert({
      where: { communityId_userId: { communityId: defaultCommunity.id, userId: adminUser.id } },
      update: {},
      create: { communityId: defaultCommunity.id, userId: adminUser.id },
    });
    await prismaRef.user.update({
      where: { id: adminUser.id },
      data: { activeCommunityId: defaultCommunity.id },
    });
    const adminRegister = await call('POST', '/merchant/register', adminToken, {
      shopName: `M6管理员店铺_${marker}`,
      licenseNo: `M6LICA_${marker}`,
      contactPhone: '13800000008',
    });
    assert(adminRegister.body?.code === 0, '契约点8：管理员商家注册成功', JSON.stringify(adminRegister.body));
    const adminProfile = await call('GET', '/merchant/profile', adminToken);
    const adminMerchantId = adminProfile.body?.data?.id;
    created.merchantIds.push(adminMerchantId);
    await prismaRef.merchant.update({ where: { id: adminMerchantId }, data: { status: 'APPROVED' } });
    // 管理员建 PENDING 岗位（同商家必填四件套）
    const adminPost = await call('POST', '/job-posts', adminToken, {
      title: `M6_管理员岗位_${marker}`,
      description: 'M6 smoke 管理员免付测试岗位',
      salary: '88/天',
      location: 'M6 管理员测试地点',
      locationPoiId: `B0FFG9M6ADM_${marker}`,
      locationLng: 116.397428,
      locationLat: 39.90923,
      locationCity: '北京',
      category: 'RETAIL',
      settlement: 'DAILY',
      workDates: ['周日'],
      workPeriods: ['全天'],
      headcount: 1,
      questions: [],
      duration: 'D30',
    });
    assert(adminPost.body?.code === 0, '契约点8：管理员创建 PENDING 岗位成功', JSON.stringify(adminPost.body));
    const adminPostId = adminPost.body.data.id;
    created.jobPostIds.push(adminPostId);
    // 免支付发布：同一下单接口，响应直接 PAID + PUBLISHED + waived，前端凭此跳过支付页
    const adminPublish = await call('POST', '/payments/job-publish', adminToken, {
      jobPostId: adminPostId,
      duration: 'D30',
    });
    assert(adminPublish.body?.code === 0, '契约点8：管理员付费发布接口成功', JSON.stringify(adminPublish.body));
    const ad = adminPublish.body.data;
    assertEq(ad.status, 'PAID', '契约点8：返回 status=PAID（未付直发）');
    assertEq(ad.waived, true, '契约点8：返回 waived=true（免支付标记）');
    assertEq(ad.jobPostStatus, 'PUBLISHED', '契约点8：返回 jobPostStatus=PUBLISHED');
    assertEq(ad.virtualPayParams, null, '契约点8：返回 virtualPayParams=null（无需拉起支付）');
    created.paymentOrderIds.push(ad.orderId);
    const adminOrderDb = await prismaRef.paymentOrder.findUnique({
      where: { id: ad.orderId },
      select: { status: true, waived: true, amount: true, channel: true },
    });
    assertEq(adminOrderDb?.waived, true, '契约点8：DB paymentOrder.waived=true');
    assertEq(adminOrderDb?.status, 'PAID', '契约点8：DB paymentOrder.status=PAID');
    assertEq(adminOrderDb?.channel, 'XPAY', '契约点8：DB paymentOrder.channel=XPAY');
    const adminPostDb = await prismaRef.jobPost.findUnique({
      where: { id: adminPostId },
      select: { status: true },
    });
    assertEq(adminPostDb?.status, 'PUBLISHED', '契约点8：DB jobPost.status=PUBLISHED（免付直发）');
    // 非 ADMIN 商家不受影响：已由契约点1 走正常 mock 支付路径覆盖

    // ===== 契约点2：refund mock =====
    console.log('\n[契约点2] refund dev mock');
    const refundResp = await call('POST', `/payments/${orderId}/refund`, merchantToken, {
      reason: `M6测试退款_${marker}`,
    });
    assert(refundResp.body?.code === 0, '契约点2：退款接口成功', JSON.stringify(refundResp.body));
    const rd = refundResp.body.data;
    assertEq(rd.status, 'REFUNDED', '契约点2：返回 status=REFUNDED');
    // DB 复查
    const orderAfterRefund = await prismaRef.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true, refundStatus: true, refundReason: true, refundedAt: true },
    });
    const postAfterRefund = await prismaRef.jobPost.findUnique({
      where: { id: postId },
      select: { status: true },
    });
    assertEq(orderAfterRefund?.status, 'REFUNDED', '契约点2：DB paymentOrder.status=REFUNDED');
    assertEq(orderAfterRefund?.refundStatus, 'SUCCESS', '契约点2：DB paymentOrder.refundStatus=SUCCESS');
    assertEq(postAfterRefund?.status, 'TAKEN_DOWN', '契约点2：DB jobPost.status=TAKEN_DOWN');
    assert(orderAfterRefund?.refundedAt !== null, '契约点2：DB refundedAt 已置位');

    // ===== 契约点3：getOrder =====
    console.log('\n[契约点3] getOrder');
    const getResp = await call('GET', `/payments/${orderId}`, merchantToken);
    assertEq(getResp.status, 200, '契约点3：GET /payments/:orderId HTTP 200');
    assertEq(getResp.body?.code, 0, '契约点3：getOrder code=0');
    assertEq(getResp.body?.data?.status, 'REFUNDED', '契约点3：返回 status=REFUNDED');
    assertEq(getResp.body?.data?.orderId, orderId, '契约点3：返回 orderId 一致');

    // ===== 契约点4：sync dev 本地 =====
    console.log('\n[契约点4] sync dev 本地');
    const syncResp = await call('POST', `/payments/${orderId}/sync`, merchantToken);
    assert(syncResp.status === 200 || syncResp.status === 201, '契约点4：POST /payments/:orderId/sync HTTP 2xx', `HTTP ${syncResp.status}`);
    assertEq(syncResp.body?.code, 0, '契约点4：sync code=0');
    assert(typeof syncResp.body?.data?.message === 'string' && syncResp.body.data.message.length > 0,
      '契约点4：返回含 message 字段', JSON.stringify(syncResp.body?.data?.message));
    assert(syncResp.body?.data?.message.includes('dev'), '契约点4：message 含 "dev"（dev 模式仅返回本地状态）', syncResp.body?.data?.message);
    assertEq(syncResp.body?.data?.status, 'REFUNDED', '契约点4：sync 后 status 仍 REFUNDED（未调真实微信）');

    // ===== 契约点5：权限（另一 user token 无权查看）=====
    console.log('\n[契约点5] 权限校验');
    const forbidden = await call('GET', `/payments/${orderId}`, studentToken);
    assertEq(forbidden.status, 403, '契约点5：另一 user token 返回 HTTP 403');
    assertEq(forbidden.body?.code, 10003, '契约点5：返回业务码 10003（无权查看）');

    // ===== 契约点6：REFUNDING 枚举存在（DB + 代码层）=====
    console.log('\n[契约点6] REFUNDING 枚举存在');
    // 代码层
    assertEq(PayStatus.REFUNDING, 'REFUNDING', '契约点6：代码层 PayStatus.REFUNDING="REFUNDING"');
    // DB 层：pg_enum 查询 enumlabel='REFUNDING' 且属于 PayStatus 类型
    const enumRows = await prismaRef.$queryRaw`
      SELECT t.typname, e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE e.enumlabel = 'REFUNDING'
    `;
    const enumArr = enumRows;
    assert(Array.isArray(enumArr) && enumArr.length >= 1, '契约点6：DB pg_enum 含 enumlabel=REFUNDING', JSON.stringify(enumArr));
    const payStatusRow = enumArr.find((r) => String(r.typname).toLowerCase().includes('paystatus'));
    assert(payStatusRow !== undefined, '契约点6：REFUNDING 属于 PayStatus 类型', JSON.stringify(enumArr.map((r) => ({ typname: r.typname, enumlabel: r.enumlabel }))));

    // ===== 契约点9：boost mock 下单（表白墙帖付费置顶）=====
    console.log('\n[契约点9] post-boost dev mock（表白墙帖）');
    // 夹具：merchant 用户已加入 cm_default 并设为活跃圈；circle 用 seed 表白圈（id 为 cuid，运行时查）
    const boostCircle = await prismaRef.circle.findFirst({ where: { name: '表白' }, select: { id: true } });
    assert(boostCircle !== null, '契约点9：seed 表白圈存在', JSON.stringify(boostCircle));
    const boostPostResp = await call('POST', `/circles/${boostCircle.id}/posts`, merchantToken, {
      content: `M6_BOOST_${marker} 内容推广 smoke 测试帖子`,
      visibility: 'PUBLIC',
    });
    assert(boostPostResp.body?.code === 0, '契约点9：创建 APPROVED/PUBLIC 测试帖子成功', JSON.stringify(boostPostResp.body));
    const boostPostId = boostPostResp.body.data.id;
    created.confessionPostIds.push(boostPostId);
    const boostPostDb = await prismaRef.post.findUnique({
      where: { id: boostPostId },
      select: { status: true, visibility: true, communityId: true },
    });
    assertEq(boostPostDb?.status, 'APPROVED', '契约点9：夹具帖子 status=APPROVED');
    assertEq(boostPostDb?.visibility, 'PUBLIC', '契约点9：夹具帖子 visibility=PUBLIC');

    const boostResp = await call('POST', '/payments/post-boost', merchantToken, {
      targetType: 'post',
      targetId: boostPostId,
      planCode: 'BOOST_1D',
    });
    assert(boostResp.body?.code === 0, '契约点9：post-boost 下单成功', JSON.stringify(boostResp.body));
    const bd = boostResp.body.data;
    assertEq(bd.status, 'PAID', '契约点9：返回 status=PAID（dev mock 直接完成）');
    assertEq(bd.virtualPayParams, null, '契约点9：返回 virtualPayParams=null（mock 路径，未调真实虚拟支付）');
    assert(
      !JSON.stringify(boostResp.body).includes('"wxPayParams"'),
      '契约点9：响应体 JSON 不含 "wxPayParams" 键（XPAY 通道不再返回 V3 下单参数）',
    );
    assert(typeof bd.boostUntil === 'string' && bd.boostUntil.length > 0, '契约点9：返回 boostUntil 非空', JSON.stringify(bd.boostUntil));
    assertEq(bd.targetType, 'post', '契约点9：返回 targetType=post');
    assertEq(bd.targetId, boostPostId, '契约点9：返回 targetId 一致');
    const boostOrderId = bd.orderId;
    assert(typeof boostOrderId === 'string' && boostOrderId.length > 0, '契约点9：返回 orderId 非空');
    created.paymentOrderIds.push(boostOrderId);
    // DB 复查：订单通道/场景/状态 + 帖子置顶到期时间
    const boostOrderDb = await prismaRef.paymentOrder.findUnique({
      where: { id: boostOrderId },
      select: { channel: true, scene: true, status: true, amount: true },
    });
    assertEq(boostOrderDb?.channel, 'XPAY', '契约点9：DB paymentOrder.channel=XPAY（推广走虚拟支付通道）');
    assertEq(boostOrderDb?.scene, 'POST_BOOST', '契约点9：DB paymentOrder.scene=POST_BOOST');
    assertEq(boostOrderDb?.status, 'PAID', '契约点9：DB paymentOrder.status=PAID');
    const boostedPostDb = await prismaRef.post.findUnique({
      where: { id: boostPostId },
      select: { boostUntil: true },
    });
    assert(
      boostedPostDb?.boostUntil instanceof Date && boostedPostDb.boostUntil.getTime() >= Date.now(),
      '契约点9：DB post.boost_until 已置位且 >= 当前时间（applyBoost 生效）',
      String(boostedPostDb?.boostUntil),
    );

    // ===== 契约点10：boost 订单 sync dev 本地 =====
    console.log('\n[契约点10] boost 订单 sync dev 本地');
    const boostSyncResp = await call('POST', `/payments/${boostOrderId}/sync`, merchantToken);
    assert(boostSyncResp.status === 200 || boostSyncResp.status === 201, '契约点10：POST /payments/:orderId/sync HTTP 2xx', `HTTP ${boostSyncResp.status}`);
    assertEq(boostSyncResp.body?.code, 0, '契约点10：sync code=0');
    assert(
      typeof boostSyncResp.body?.data?.message === 'string' && boostSyncResp.body.data.message.length > 0,
      '契约点10：返回含 message 字段', JSON.stringify(boostSyncResp.body?.data?.message));
    assert(
      boostSyncResp.body.data.message.includes('dev'),
      '契约点10：message 含 "dev"（dev 模式仅返回本地状态，未调真实微信）', boostSyncResp.body.data.message);
    assertEq(boostSyncResp.body?.data?.status, 'PAID', '契约点10：sync 后 status=PAID');

    // ===== 契约点11：boost 订单退款裁剪 =====
    console.log('\n[契约点11] boost 订单退款 + boost_until 裁剪');
    const boostRefundResp = await call('POST', `/payments/${boostOrderId}/refund`, merchantToken, {
      reason: `M6测试推广退款_${marker}`,
    });
    assert(boostRefundResp.body?.code === 0, '契约点11：退款接口成功', JSON.stringify(boostRefundResp.body));
    // 代码语义（payment.service refundOrder）：mock 下 XPAY 订单同步收敛 REFUNDED（非两态）；
    // 真实 XPAY 通道才是 PROCESSING -> REFUNDING ->（推送/轮询）REFUNDED。此处保留短轮询兼容两态实现。
    let refundFinal = boostRefundResp.body?.data?.status;
    let refundPolls = 0;
    for (let i = 0; i < 10 && refundFinal === 'REFUNDING'; i++) {
      refundPolls++;
      await sleep(500);
      refundFinal = (await call('GET', `/payments/${boostOrderId}`, merchantToken)).body?.data?.status;
    }
    assertEq(refundFinal, 'REFUNDED', `契约点11：订单最终 REFUNDED（mock 同步收敛，轮询次数=${refundPolls}）`);
    const boostOrderAfterRefund = await prismaRef.paymentOrder.findUnique({
      where: { id: boostOrderId },
      select: { status: true, refundStatus: true, refundedAt: true },
    });
    assertEq(boostOrderAfterRefund?.status, 'REFUNDED', '契约点11：DB paymentOrder.status=REFUNDED');
    assertEq(boostOrderAfterRefund?.refundStatus, 'SUCCESS', '契约点11：DB paymentOrder.refundStatus=SUCCESS');
    assert(boostOrderAfterRefund?.refundedAt !== null, '契约点11：DB refundedAt 已置位');
    // applyBoostRefund 语义（boost.service.ts）：仍处推广期则 boostUntil 置为退款时刻（非 null，立即结束推广）
    const boostedPostAfterRefund = await prismaRef.post.findUnique({
      where: { id: boostPostId },
      select: { boostUntil: true },
    });
    assert(
      boostedPostAfterRefund?.boostUntil instanceof Date && boostedPostAfterRefund.boostUntil.getTime() <= Date.now(),
      '契约点11：DB post.boost_until 已裁剪为退款时刻（非 null 且 <= 当前时间）',
      String(boostedPostAfterRefund?.boostUntil),
    );

    console.log('\n[m6 payment smoke] ALL ASSERTIONS PASSED');
  } finally {
    await cleanup(prismaRef);
    await prismaRef.$disconnect();
  }
})().catch(async (error) => {
  console.error(`\n[m6 payment smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  if (prismaRef) {
    try {
      await cleanup(prismaRef);
    } catch (cleanupError) {
      console.error('[cleanup] 清理失败:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
    }
    try {
      await prismaRef.$disconnect();
    } catch {
      // ignore disconnect failure
    }
  }
  process.exitCode = 1;
});
