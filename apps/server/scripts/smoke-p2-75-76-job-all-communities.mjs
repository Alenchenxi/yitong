/**
 * P2-75 发岗全圈同步与付费口径收敛 + P2-76 新建岗位表单字段对齐 独立 smoke
 *
 * 覆盖契约（dev mock，逐项断言）：
 * 1. 商家（非平台管理员）创建岗位（POST /job-posts，communityId=归属圈）：
 *    落库 visibility_scope='ALL_COMMUNITIES'，publisher_scope='COMMUNITY'
 * 2. 跨圈可见：另一圈子用户（active 圈≠归属圈）在兼职列表能看到该岗、能进详情、能报名成功
 * 3. 付费口径收敛（圈主）：自己创建圈子的人（OWNER）在自己管理的圈子发岗 ->
 *    POST /payments/job-publish 返回非 waived 订单，金额与 GET /payments/job-publish/price
 *    的 PricingConfig 一致（dev mock 下 wxXPay 未配置 -> fulfillOrder 直接 PAID，属正常付费路径）
 *    收敛负例：仅 user_roles=ADMIN 而无 AdminUser 绑定的用户（M6 旧免付口径）同样必须付费
 * 4. 平台管理员（AdminUser + adminType.isPlatform=true）发岗 -> publish 返回 waived
 *    （订单 PAID + 岗位直接 PUBLISHED）
 * 5. 存量数据：迁移后 job_posts 全表无 visibility_scope='COMMUNITY' 残留（只读核验）
 * 6. 新建岗位表单字段：workDates / urgent / online / questions / contactWechat / contactPhone
 *    全部落库；不传 contactWechat 时快照落商家资料
 *
 * 环境适配：.env 配有真实 WX_USER_APPID/SECRET，起 server 须带 `WX_USER_APPID= WX_USER_SECRET=`
 * 空值前缀强制 mock。本脚本用 prisma 直建测试 user + user_role，并以 Node crypto 手签 HS256 JWT
 * （JWT_SECRET 从 .env 读）绕过微信登录；支付侧 WX_XPAY_* 未配置 -> dev mock 路径（本次测试目标）。
 *
 * 用法：
 *   cd <worktree>/apps/server
 *   node scripts/smoke-p2-75-76-job-all-communities.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
// 脚本位于 <server>/scripts/，server 根 = 脚本目录上一级（不依赖硬编码主仓路径）
const SERVER_DIR = process.env.SERVER_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(key) {
  const envPath = path.join(SERVER_DIR, '.env');
  if (!fs.existsSync(envPath)) return null;
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!m) return null;
  let val = m[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

const DB = process.env.DATABASE_URL || readEnv('DATABASE_URL')
  || 'postgresql://postgres:postgres@localhost:5432/yitong?schema=public';

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// 手签 HS256 JWT，兼容 @nestjs/jwt JwtService.verifyAsync
function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7200 };
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
  communityIds: [],
  jobPostIds: [],
  paymentOrderIds: [],
  adminUserIds: [],
  adminTypeIds: [], // 仅本脚本自建的 AdminType
};
let prismaRef = null;
let marker = '';
let mockOpenidPrefixes = [];
let jwtSecret = '';

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理本 smoke 创建的数据...');

  // 按 marker / openid 前缀重新发现 id，避免中途断言失败残留。
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

  const markerCommunities = await prisma.community.findMany({
    where: userIds.length > 0 ? { ownerId: { in: userIds } } : { id: { in: [] } },
    select: { id: true },
  });
  const communityIds = [...new Set([...created.communityIds, ...markerCommunities.map((row) => row.id)])];

  const markerPosts = await prisma.jobPost.findMany({
    where: {
      OR: [
        ...(merchantIds.length > 0 ? [{ merchantId: { in: merchantIds } }] : []),
        { title: { startsWith: `P275_${marker}` } },
      ],
    },
    select: { id: true },
  });
  const postIds = [...new Set([...created.jobPostIds, ...markerPosts.map((row) => row.id)])];

  const markerOrders = await prisma.paymentOrder.findMany({
    where: {
      OR: [
        ...(postIds.length > 0 ? [{ jobPostId: { in: postIds } }] : []),
        ...(merchantIds.length > 0 ? [{ merchantId: { in: merchantIds } }] : []),
        ...(created.paymentOrderIds.length > 0 ? [{ id: { in: created.paymentOrderIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const orderIds = [...new Set([...created.paymentOrderIds, ...markerOrders.map((row) => row.id)])];

  const markerAdminUsers = await prisma.adminUser.findMany({
    where: { OR: [
      ...(created.adminUserIds.length > 0 ? [{ id: { in: created.adminUserIds } }] : []),
      { username: { startsWith: `p275_${marker}` } },
    ] },
    select: { id: true },
  });

  const deleteMany = async (label, operation) => {
    const result = await operation();
    console.log(`  ${label}: ${result.count}`);
    return result.count;
  };

  // 子表先删；按 FK 反向顺序（job_posts.communityId Restrict -> 删圈前先删岗）。
  await deleteMany('payment_orders', () =>
    prisma.paymentOrder.deleteMany({ where: orderIds.length > 0 ? { id: { in: orderIds } } : { id: { in: [] } } }));
  await deleteMany('job_applications', () =>
    prisma.jobApplication.deleteMany({ where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { jobPostId: { in: [] } } }));
  await deleteMany('job_views', () =>
    prisma.jobView.deleteMany({ where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { jobPostId: { in: [] } } }));
  await deleteMany('job_impressions', () =>
    prisma.jobImpression.deleteMany({ where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { jobPostId: { in: [] } } }));
  await deleteMany('notifications', () =>
    prisma.notification.deleteMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : [{ userId: { in: [] } }]),
          ...(postIds.length > 0 ? [{ targetType: 'job_post', targetId: { in: postIds } }] : [{ id: { in: [] } }]),
        ],
      },
    }));
  await deleteMany('search_histories(防御性)', () =>
    prisma.searchHistory.deleteMany({ where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: { in: [] } } }));
  await deleteMany('job_posts', () =>
    prisma.jobPost.deleteMany({ where: postIds.length > 0 ? { id: { in: postIds } } : { id: { in: [] } } }));
  await deleteMany('admin_users(自建)', () =>
    prisma.adminUser.deleteMany({ where: markerAdminUsers.length > 0 ? { id: { in: markerAdminUsers.map((r) => r.id) } } : { id: { in: [] } } }));
  if (created.adminTypeIds.length > 0) {
    await deleteMany('admin_types(自建)', () =>
      prisma.adminType.deleteMany({ where: { id: { in: created.adminTypeIds } } }));
  }
  await deleteMany('merchants', () =>
    prisma.merchant.deleteMany({ where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: { in: [] } } }));
  await deleteMany('user_roles', () =>
    prisma.userRole.deleteMany({ where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: { in: [] } } }));
  await deleteMany('communities(自建 C1/C2)', () =>
    prisma.community.deleteMany({ where: communityIds.length > 0 ? { id: { in: communityIds } } : { id: { in: [] } } }));
  await deleteMany('users', () =>
    prisma.user.deleteMany({ where: userIds.length > 0 ? { id: { in: userIds } } : { id: { in: [] } } }));

  // 逐表自验证：marker 查询确认无测试残留
  const remain = {
    users: mockOpenidPrefixes.length > 0
      ? await prisma.user.count({ where: { OR: mockOpenidPrefixes.map((prefix) => ({ openid: { startsWith: prefix } })) } })
      : 0,
    merchants: await prisma.merchant.count({ where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: { in: [] } } }),
    communities: await prisma.community.count({ where: userIds.length > 0 ? { ownerId: { in: userIds } } : { id: { in: [] } } }),
    job_posts: await prisma.jobPost.count({ where: postIds.length > 0 ? { id: { in: postIds } } : { id: { in: [] } } }),
    orders: await prisma.paymentOrder.count({ where: orderIds.length > 0 ? { id: { in: orderIds } } : { id: { in: [] } } }),
    roles: await prisma.userRole.count({ where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: { in: [] } } }),
    admin_users: await prisma.adminUser.count({ where: { username: { startsWith: `p275_${marker}` } } }),
    notifications: await prisma.notification.count({ where: userIds.length > 0 ? { userId: { in: userIds } } : { userId: { in: [] } } }),
    applications: await prisma.jobApplication.count({ where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { jobPostId: { in: [] } } }),
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

// 商家入驻 + dev 直审（seed merchant.need_review=true -> 注册落 PENDING，夹具置 APPROVED）
async function registerApprovedMerchant(token, shopName, licenseNo, phone) {
  const registration = await call('POST', '/merchant/register', token, {
    shopName,
    licenseNo,
    contactPhone: phone,
  });
  assert(registration.body?.code === 0, `商家注册成功(${shopName})`, JSON.stringify(registration.body));
  const profile = await call('GET', '/merchant/profile', token);
  assert(profile.body?.code === 0, `读取商家 profile 成功(${shopName})`);
  const merchantId = profile.body.data.id;
  created.merchantIds.push(merchantId);
  await prismaRef.merchant.update({ where: { id: merchantId }, data: { status: 'APPROVED' } });
  return merchantId;
}

(async () => {
  console.log('[P2-75/76 smoke] BASE =', BASE);
  marker = `p275_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  jwtSecret = readEnv('JWT_SECRET') || 'dev-secret-change-me';
  const { PrismaClient } = await import('@prisma/client');
  prismaRef = new PrismaClient({ datasources: { db: { url: DB } } });

  try {
    // ===== 契约点5：存量数据只读核验（迁移后全表无 COMMUNITY 可见残留）=====
    console.log('\n[契约点5] 存量 visibility_scope 核验（只读）');
    const legacyRows = await prismaRef.$queryRaw`
      SELECT COUNT(*)::int AS n FROM "job_posts" WHERE "visibility_scope" = 'COMMUNITY'`;
    const legacyCount = Number(legacyRows[0]?.n ?? 0);
    assertEq(legacyCount, 0, '契约点5：job_posts 全表无 visibility_scope=COMMUNITY 残留');

    // ===== 夹具：四类身份 =====
    // 圈主商家（MERCHANT 角色）：API 创建圈子 C1 -> creator=OWNER + active 圈自动切换
    const ownerOpenid = `mock_p275own_${marker}`;
    const studentOpenid = `mock_p275stu_${marker}`;
    const roleOnlyAdminOpenid = `mock_p275rad_${marker}`;
    const platformAdminOpenid = `mock_p275pad_${marker}`;
    mockOpenidPrefixes = [ownerOpenid, studentOpenid, roleOnlyAdminOpenid, platformAdminOpenid];

    const { user: ownerUser, token: ownerToken } = await createTestUser(
      prismaRef, ownerOpenid, `P275圈主商家_${marker}`, 'MERCHANT');
    created.userIds.push(ownerUser.id);
    const meResp = await call('GET', '/auth/me', ownerToken);
    assert(meResp.status === 200 && meResp.body?.code === 0, 'JWT 签发可用：GET /auth/me 成功', JSON.stringify(meResp.body));

    // 圈主创建圈子 C1（seed community.need_review=false -> ACTIVE + OWNER + activeCommunityId 切换）
    const createC1 = await call('POST', '/community', ownerToken, {
      name: `圈A_${marker.slice(-10)}`,
      category: '校园',
      region: '北京',
      location: '海淀区测试路1号',
    });
    assert(createC1.body?.code === 0, '创建圈子 C1 成功', JSON.stringify(createC1.body));
    const c1Id = createC1.body.data.id;
    created.communityIds.push(c1Id);
    assertEq(createC1.body.data.pending, false, 'C1 无需审核（need_review=false）');
    const c1Db = await prismaRef.community.findUnique({
      where: { id: c1Id },
      select: { status: true, ownerId: true },
    });
    assertEq(c1Db?.status, 'ACTIVE', 'C1 状态 ACTIVE');
    assertEq(c1Db?.ownerId, ownerUser.id, 'C1 圈主=创建者（OWNER）');
    const c1Member = await prismaRef.communityMember.findUnique({
      where: { communityId_userId: { communityId: c1Id, userId: ownerUser.id } },
      select: { role: true },
    });
    assertEq(c1Member?.role, 'OWNER', '圈主成员角色=OWNER');

    // 学生用户（USER 角色）：API 创建圈子 C2 -> active 圈=C2（≠归属圈 C1）
    const { user: studentUser, token: studentToken } = await createTestUser(
      prismaRef, studentOpenid, `P275学生_${marker}`, 'USER');
    created.userIds.push(studentUser.id);
    const createC2 = await call('POST', '/community', studentToken, {
      name: `圈B_${marker.slice(-10)}`,
      category: '兴趣',
      region: '上海',
      location: '杨浦区测试路2号',
    });
    assert(createC2.body?.code === 0, '创建圈子 C2 成功', JSON.stringify(createC2.body));
    const c2Id = createC2.body.data.id;
    created.communityIds.push(c2Id);
    const studentActive = await prismaRef.user.findUnique({
      where: { id: studentUser.id },
      select: { activeCommunityId: true },
    });
    assertEq(studentActive?.activeCommunityId, c2Id, '学生 active 圈=C2（≠归属圈 C1）');
    assert(c2Id !== c1Id, 'C2 与 C1 是不同圈子');

    // 圈主商家入驻（contractPhone 传 13900000075，快照兜底断言用）
    const ownerMerchantId = await registerApprovedMerchant(
      ownerToken, `P275圈主店铺_${marker}`, `P275LIC_${marker}`, '13900000075');
    // 契约点6 兜底：商家资料补 contactWechat（register 无该字段）
    await prismaRef.merchant.update({
      where: { id: ownerMerchantId },
      data: { contactWechat: 'owner_wx_default' },
    });

    // ===== 契约点1 + 6：商家创建岗位（全字段）=====
    console.log('\n[契约点1+6] 商家发岗：全圈可见 + 表单字段落库');
    const fullPostResp = await call('POST', '/job-posts', ownerToken, {
      title: `P275_${marker}_全字段岗`,
      description: 'P2-75/76 smoke 全字段测试岗位描述',
      salary: '120/天',
      location: 'P275 测试地点',
      locationPoiId: `B0FFP275SMK_${marker}`,
      locationLng: 116.397428,
      locationLat: 39.90923,
      locationCity: '北京',
      category: 'CATERING',
      settlement: 'DAILY',
      workDates: ['周一', '周三'],
      workPeriods: ['全天'],
      headcount: 5,
      urgent: true,
      online: true,
      questions: ['有空吗'],
      duration: 'D30',
      communityId: c1Id,
      contactWechat: 'test_wx_123',
      contactPhone: '13800000123',
    });
    assert(fullPostResp.body?.code === 0, '契约点1：创建岗位成功（communityId=归属圈 C1）', JSON.stringify(fullPostResp.body));
    const fullPostId = fullPostResp.body.data.id;
    created.jobPostIds.push(fullPostId);
    const fullPostDb = await prismaRef.jobPost.findUnique({
      where: { id: fullPostId },
      select: {
        visibilityScope: true, publisherScope: true, communityId: true, status: true,
        workDates: true, urgent: true, online: true, questions: true,
        contactWechatSnapshot: true, contactPhoneSnapshot: true,
      },
    });
    assertEq(fullPostDb?.visibilityScope, 'ALL_COMMUNITIES', '契约点1：DB visibility_scope=ALL_COMMUNITIES（全圈同步）');
    assertEq(fullPostDb?.publisherScope, 'COMMUNITY', '契约点1：DB publisher_scope=COMMUNITY（非平台管理员）');
    assertEq(fullPostDb?.communityId, c1Id, '契约点1：DB community_id=归属圈 C1');
    assertEq(fullPostDb?.status, 'PENDING', '契约点1：创建后状态 PENDING（待付费发布）');
    // 契约点6：表单字段逐一核对
    assertEq(fullPostDb?.workDates, ['周一', '周三'], '契约点6：work_dates=["周一","周三"] 落库');
    assertEq(fullPostDb?.urgent, true, '契约点6：urgent=true 落库');
    assertEq(fullPostDb?.online, true, '契约点6：online=true 落库');
    assertEq(fullPostDb?.questions, ['有空吗'], '契约点6：questions=["有空吗"] 落库');
    assertEq(fullPostDb?.contactWechatSnapshot, 'test_wx_123', '契约点6：contact_wechat_snapshot=test_wx_123 落库');
    assertEq(fullPostDb?.contactPhoneSnapshot, '13800000123', '契约点6：contact_phone_snapshot=13800000123 落库');

    // 契约点6（不传联系方式 -> 快照落商家资料）
    const barePostResp = await call('POST', '/job-posts', ownerToken, {
      title: `P275_${marker}_默认快照岗`,
      description: 'P2-76 不传联系方式快照兜底测试岗位',
      salary: '100/天',
      location: 'P275 默认快照地点',
      locationPoiId: `B0FFP275BARE_${marker}`,
      locationLng: 116.4,
      locationLat: 39.9,
      locationCity: '北京',
      category: 'RETAIL',
      settlement: 'WEEKLY',
      workDates: ['周六'],
      workPeriods: ['上午'],
      duration: 'D30',
      communityId: c1Id,
    });
    assert(barePostResp.body?.code === 0, '契约点6：不传联系方式创建岗位成功', JSON.stringify(barePostResp.body));
    const barePostId = barePostResp.body.data.id;
    created.jobPostIds.push(barePostId);
    const barePostDb = await prismaRef.jobPost.findUnique({
      where: { id: barePostId },
      select: { contactWechatSnapshot: true, contactPhoneSnapshot: true },
    });
    assertEq(barePostDb?.contactWechatSnapshot, 'owner_wx_default', '契约点6：不传 contactWechat -> 快照落商家资料(owner_wx_default)');
    assertEq(barePostDb?.contactPhoneSnapshot, '13900000075', '契约点6：不传 contactPhone -> 快照落商家资料(13900000075)');

    // ===== 发布全字段岗（mock 付费路径），供契约点2 跨圈可见 =====
    console.log('\n[前置] 圈主付费发布全字段岗（dev mock）');
    const priceResp = await call('GET', '/payments/job-publish/price', ownerToken);
    assert(priceResp.body?.code === 0, 'GET /payments/job-publish/price 成功');
    const priceD30 = priceResp.body.data.find((p) => p.duration === 'D30');
    assert(!!priceD30, 'PricingConfig D30 存在', JSON.stringify(priceResp.body.data));
    console.log(`  PricingConfig: D30=${priceD30.price}`);

    const publishResp = await call('POST', '/payments/job-publish', ownerToken, {
      jobPostId: fullPostId,
      duration: 'D30',
    });
    assert(publishResp.body?.code === 0, '付费发布接口成功', JSON.stringify(publishResp.body));
    const pd = publishResp.body.data;
    created.paymentOrderIds.push(pd.orderId);
    assert(pd.waived !== true, '圈主发岗非 waived（正常付费路径）', JSON.stringify(pd));
    assertEq(pd.amount, priceD30.price, '发布订单金额与 PricingConfig D30 单价一致');
    assertEq(pd.jobPostStatus, 'PUBLISHED', '发布后岗位 PUBLISHED（dev mock 直接完成支付）');
    assertEq(pd.status, 'PAID', 'mock 支付后订单 PAID（wxXPay 未配置走 mock 直发）');
    const publishOrderDb = await prismaRef.paymentOrder.findUnique({
      where: { id: pd.orderId },
      select: { status: true, waived: true, amount: true, channel: true },
    });
    assertEq(publishOrderDb?.waived, false, 'DB 订单 waived=false');
    assertEq(publishOrderDb?.amount?.toString(), priceD30.price, 'DB 订单金额与 PricingConfig 一致');
    assertEq(publishOrderDb?.channel, 'XPAY', 'DB 订单 channel=XPAY');

    // ===== 契约点2：跨圈可见（学生 active 圈=C2 ≠ 归属圈 C1）=====
    console.log('\n[契约点2] 跨圈可见：列表 / 详情 / 报名');
    const listResp = await call('GET', '/job-posts?limit=50', studentToken);
    assert(listResp.body?.code === 0, '契约点2：跨圈用户 GET /job-posts 成功');
    const found = (listResp.body.data?.list ?? []).some((p) => p.id === fullPostId);
    assert(found, '契约点2：跨圈用户列表能看到归属圈 C1 的岗位（ALL_COMMUNITIES）',
      `list length=${listResp.body.data?.list?.length}`);
    const detailResp = await call('GET', `/job-posts/${fullPostId}`, studentToken);
    assert(detailResp.body?.code === 0, '契约点2：跨圈用户能进岗位详情', JSON.stringify(detailResp.body?.code));
    assertEq(detailResp.body?.data?.id, fullPostId, '契约点2：详情返回同一岗位');
    const applyResp = await call('POST', `/job-posts/${fullPostId}/applications`, studentToken, {
      answers: ['有空，周六可以'],
    });
    assert(applyResp.body?.code === 0, '契约点2：跨圈用户报名成功', JSON.stringify(applyResp.body));
    const applyDb = await prismaRef.jobApplication.findUnique({
      where: { jobPostId_userId: { jobPostId: fullPostId, userId: studentUser.id } },
      select: { status: true, answers: true },
    });
    assertEq(applyDb?.status, 'PENDING', '契约点2：DB 报名记录 PENDING');
    assert(
      Array.isArray(applyDb?.answers)
        && applyDb.answers.length === 1
        && applyDb.answers[0]?.question === '有空吗'
        && applyDb.answers[0]?.answer === '有空，周六可以',
      '契约点2：报名答案与岗位问题对齐落库',
      JSON.stringify(applyDb?.answers),
    );

    // ===== 契约点3：付费口径收敛（圈主不免付）=====
    console.log('\n[契约点3] 圈主（自己创建圈子的人=OWNER）发岗付费口径');
    const ownerPostResp = await call('POST', '/job-posts', ownerToken, {
      title: `P275_${marker}_圈主付费岗`,
      description: 'P2-75 圈主付费口径测试岗位',
      salary: '150/天',
      location: 'P275 圈主付费地点',
      locationPoiId: `B0FFP275OWN_${marker}`,
      locationLng: 116.41,
      locationLat: 39.91,
      locationCity: '北京',
      category: 'PROMOTION',
      settlement: 'DAILY',
      workDates: ['周二'],
      workPeriods: ['下午'],
      duration: 'D30',
      communityId: c1Id,
    });
    assert(ownerPostResp.body?.code === 0, '契约点3：圈主在自己管理的圈子发岗成功', JSON.stringify(ownerPostResp.body));
    const ownerPostId = ownerPostResp.body.data.id;
    created.jobPostIds.push(ownerPostId);
    const ownerPublish = await call('POST', '/payments/job-publish', ownerToken, {
      jobPostId: ownerPostId,
      duration: 'D30',
    });
    assert(ownerPublish.body?.code === 0, '契约点3：圈主付费发布接口成功', JSON.stringify(ownerPublish.body));
    const od = ownerPublish.body.data;
    created.paymentOrderIds.push(od.orderId);
    assert(od.waived !== true, '契约点3：圈主发岗非 waived（P2-75 收敛后圈内角色不免付）', JSON.stringify(od));
    assertEq(od.amount, priceD30.price, '契约点3：订单金额与 PricingConfig D30 一致');
    const ownerOrderDb = await prismaRef.paymentOrder.findUnique({
      where: { id: od.orderId },
      select: { waived: true, amount: true, status: true },
    });
    assertEq(ownerOrderDb?.waived, false, '契约点3：DB 订单 waived=false');
    assertEq(ownerOrderDb?.amount?.toString(), priceD30.price, '契约点3：DB 订单金额与 PricingConfig 一致');
    assert(['PENDING', 'PAID'].includes(ownerOrderDb?.status), '契约点3：DB 订单为正常付费订单', JSON.stringify(ownerOrderDb?.status));

    // ===== 收敛负例：仅 user_roles=ADMIN（无 AdminUser 绑定）不再免付 =====
    console.log('\n[收敛负例] 仅 ADMIN 角色无 AdminUser 绑定的用户不再免付');
    const { user: roleOnlyAdmin, token: roleOnlyAdminToken } = await createTestUser(
      prismaRef, roleOnlyAdminOpenid, `P275仅角色管理员_${marker}`, 'ADMIN');
    created.userIds.push(roleOnlyAdmin.id);
    // 断言该身份确实无 AdminUser 绑定
    const boundAdmin = await prismaRef.adminUser.findUnique({ where: { openid: roleOnlyAdminOpenid } });
    assertEq(boundAdmin, null, '负例前提：该用户无 AdminUser 绑定（openid 维度）');
    const roleAdminMerchantId = await registerApprovedMerchant(
      roleOnlyAdminToken, `P275角色管理员店铺_${marker}`, `P275LICRA_${marker}`, '13900000076');
    void roleAdminMerchantId;
    // 加入归属圈 C1 并设为活跃圈（与发岗口径一致）
    await prismaRef.communityMember.upsert({
      where: { communityId_userId: { communityId: c1Id, userId: roleOnlyAdmin.id } },
      update: {},
      create: { communityId: c1Id, userId: roleOnlyAdmin.id },
    });
    await prismaRef.user.update({ where: { id: roleOnlyAdmin.id }, data: { activeCommunityId: c1Id } });
    const roleAdminPost = await call('POST', '/job-posts', roleOnlyAdminToken, {
      title: `P275_${marker}_角色管理员岗`,
      description: 'P2-75 ADMIN 角色无 AdminUser 收敛负例岗位',
      salary: '130/天',
      location: 'P275 负例地点',
      locationPoiId: `B0FFP275RA_${marker}`,
      locationLng: 116.42,
      locationLat: 39.92,
      locationCity: '北京',
      category: 'SURVEY',
      settlement: 'COMPLETION',
      workDates: ['周五'],
      workPeriods: ['晚上'],
      duration: 'D30',
      communityId: c1Id,
    });
    assert(roleAdminPost.body?.code === 0, '负例：仅角色 ADMIN 用户发岗成功', JSON.stringify(roleAdminPost.body));
    created.jobPostIds.push(roleAdminPost.body.data.id);
    const roleAdminPublish = await call('POST', '/payments/job-publish', roleOnlyAdminToken, {
      jobPostId: roleAdminPost.body.data.id,
      duration: 'D30',
    });
    assert(roleAdminPublish.body?.code === 0, '负例：付费发布接口成功', JSON.stringify(roleAdminPublish.body));
    const rad = roleAdminPublish.body.data;
    created.paymentOrderIds.push(rad.orderId);
    assert(rad.waived !== true, '负例：仅 ADMIN 角色无 AdminUser -> 非 waived（M6 旧免付口径已收敛）', JSON.stringify(rad));
    assertEq(rad.amount, priceD30.price, '负例：订单金额与 PricingConfig D30 一致');
    const radOrderDb = await prismaRef.paymentOrder.findUnique({
      where: { id: rad.orderId },
      select: { waived: true },
    });
    assertEq(radOrderDb?.waived, false, '负例：DB 订单 waived=false');

    // ===== 契约点4：平台管理员（AdminUser + adminType.isPlatform）waived =====
    console.log('\n[契约点4] 平台管理员免支付发岗');
    const { user: platformAdmin, token: platformAdminToken } = await createTestUser(
      prismaRef, platformAdminOpenid, `P275平台管理员_${marker}`, 'MERCHANT');
    created.userIds.push(platformAdmin.id);
    // 夹具：AdminUser 绑定 openid + adminType.isPlatform=true（优先复用 seed at_platform）
    let platformType = await prismaRef.adminType.findUnique({ where: { code: 'PLATFORM_ADMIN' } });
    if (!platformType) {
      platformType = await prismaRef.adminType.create({
        data: {
          name: `P275平台类型_${marker}`,
          code: `P275_PLATFORM_${marker}`,
          isPlatform: true,
          active: true,
        },
      });
      created.adminTypeIds.push(platformType.id);
      console.log(`  (seed PLATFORM_ADMIN 缺失，已自建 AdminType id=${platformType.id}，测完删除)`);
    } else {
      console.log(`  (复用 seed AdminType PLATFORM_ADMIN id=${platformType.id} isPlatform=${platformType.isPlatform})`);
    }
    assertEq(platformType.isPlatform, true, 'AdminType.isPlatform=true');
    const adminUserRow = await prismaRef.adminUser.create({
      data: {
        username: `p275_${marker}_platform`,
        openid: platformAdminOpenid,
        adminTypeId: platformType.id,
        allCommunities: true,
      },
    });
    created.adminUserIds.push(adminUserRow.id);
    const padMerchantId = await registerApprovedMerchant(
      platformAdminToken, `P275平台管理员店铺_${marker}`, `P275LICPA_${marker}`, '13900000077');
    void padMerchantId;
    // 平台管理员加入 C1 发岗（与商家同圈，验证同圈不同身份的付费口径分野）
    await prismaRef.communityMember.upsert({
      where: { communityId_userId: { communityId: c1Id, userId: platformAdmin.id } },
      update: {},
      create: { communityId: c1Id, userId: platformAdmin.id },
    });
    await prismaRef.user.update({ where: { id: platformAdmin.id }, data: { activeCommunityId: c1Id } });
    const padPost = await call('POST', '/job-posts', platformAdminToken, {
      title: `P275_${marker}_平台管理员岗`,
      description: 'P2-75 平台管理员 waived 测试岗位',
      salary: '200/天',
      location: 'P275 平台管理员地点',
      locationPoiId: `B0FFP275PA_${marker}`,
      locationLng: 116.43,
      locationLat: 39.93,
      locationCity: '北京',
      category: 'INTERNSHIP',
      settlement: 'MONTHLY',
      workDates: ['周日'],
      workPeriods: ['全天'],
      duration: 'D30',
      communityId: c1Id,
    });
    assert(padPost.body?.code === 0, '契约点4：平台管理员创建岗位成功', JSON.stringify(padPost.body));
    const padPostId = padPost.body.data.id;
    created.jobPostIds.push(padPostId);
    const padPostDb = await prismaRef.jobPost.findUnique({
      where: { id: padPostId },
      select: { publisherScope: true, visibilityScope: true },
    });
    assertEq(padPostDb?.publisherScope, 'PLATFORM', '契约点4：平台管理员岗位 publisher_scope=PLATFORM');
    assertEq(padPostDb?.visibilityScope, 'ALL_COMMUNITIES', '契约点4：平台管理员岗位 visibility_scope=ALL_COMMUNITIES');
    const padPublish = await call('POST', '/payments/job-publish', platformAdminToken, {
      jobPostId: padPostId,
      duration: 'D30',
    });
    assert(padPublish.body?.code === 0, '契约点4：平台管理员发布接口成功', JSON.stringify(padPublish.body));
    const pad = padPublish.body.data;
    created.paymentOrderIds.push(pad.orderId);
    assertEq(pad.waived, true, '契约点4：返回 waived=true');
    assertEq(pad.status, 'PAID', '契约点4：返回 status=PAID（未付直发）');
    assertEq(pad.jobPostStatus, 'PUBLISHED', '契约点4：返回 jobPostStatus=PUBLISHED');
    assertEq(pad.virtualPayParams, null, '契约点4：virtualPayParams=null（无需拉起支付）');
    const padOrderDb = await prismaRef.paymentOrder.findUnique({
      where: { id: pad.orderId },
      select: { status: true, waived: true, amount: true },
    });
    assertEq(padOrderDb?.waived, true, '契约点4：DB paymentOrder.waived=true');
    assertEq(padOrderDb?.status, 'PAID', '契约点4：DB paymentOrder.status=PAID');
    assertEq(padOrderDb?.amount?.toString(), priceD30.price, '契约点4：DB waived 订单金额仍按 PricingConfig 记账');
    const padPostAfter = await prismaRef.jobPost.findUnique({
      where: { id: padPostId },
      select: { status: true, expireAt: true },
    });
    assertEq(padPostAfter?.status, 'PUBLISHED', '契约点4：DB jobPost.status=PUBLISHED（免付直发）');
    assert(padPostAfter?.expireAt !== null, '契约点4：DB jobPost.expireAt 已置位');

    console.log('\n[P2-75/76 smoke] ALL ASSERTIONS PASSED');
  } finally {
    await cleanup(prismaRef);
    await prismaRef.$disconnect();
  }
})().catch(async (error) => {
  console.error(`\n[P2-75/76 smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
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
