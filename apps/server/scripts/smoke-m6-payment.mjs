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

  const markerOrders = await prisma.paymentOrder.findMany({
    where: {
      OR: [
        ...(postIds.length > 0 ? [{ jobPostId: { in: postIds } }] : []),
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

    const { user: studentUser, token: studentToken } = await createTestUser(
      prismaRef, studentOpenid, `M6学生_${marker}`, 'USER',
    );
    created.userIds.push(studentUser.id);
    console.log(`  创建测试学生用户 uid=${studentUser.id} openid=${studentOpenid}`);

    // 验证 JWT 可用：调一个受保护接口 GET /auth/me（若 401 说明 JWT 签发有误）
    const meResp = await call('GET', '/auth/me', merchantToken);
    assert(meResp.status === 200 && meResp.body?.code === 0, 'JWT 签发可用：GET /auth/me 成功', JSON.stringify(meResp.body));

    // 商家入驻（dev 自动 APPROVED）
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
    assertEq(profile.body.data.status, 'APPROVED', '测试商家 dev 状态为 APPROVED');

    // 确保 PricingConfig.D30 存在（seed 应已建；缺则自建，测完删除）
    let pricingD30 = await prismaRef.pricingConfig.findUnique({ where: { duration: 'D30' } });
    if (!pricingD30) {
      pricingD30 = await prismaRef.pricingConfig.create({ data: { duration: 'D30', price: 90 } });
      selfCreatedPricing = true;
      console.log(`  (PricingConfig.D30 缺失，已自建 price=90，测完将删除)`);
    } else {
      console.log(`  (PricingConfig.D30 已存在 price=${pricingD30.price.toString()}，不改动)`);
    }

    // 创建 PENDING 岗位
    const createdPost = await call('POST', '/job-posts', merchantToken, {
      title: `M6_测试岗位_${marker}`,
      description: 'M6 smoke 测试岗位描述',
      salary: '100/天',
      location: 'M6 测试地点',
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
    assertEq(pd.jobPostStatus, 'PUBLISHED', '契约点1：返回 jobPostStatus=PUBLISHED');
    const orderId = pd.orderId;
    assert(typeof orderId === 'string' && orderId.length > 0, '契约点1：返回 orderId 非空');
    created.paymentOrderIds.push(orderId);
    // DB 复查
    const orderAfterPublish = await prismaRef.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true, amount: true, duration: true },
    });
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
