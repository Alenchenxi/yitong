/**
 * Prod 红线 smoke：E1 单价校验 / R5 getQueue userNickname / R1 表白墙举报 reporterId /
 *                  R4 岗位下架闭环 / E4 支付成功通知商家
 *
 * 环境适配：.env 配了真实 WX_USER_APPID/SECRET，auth.code2session 走真实微信 API，
 * 假 code 登录会失败（10004）。故本脚本用 prisma 直接创建测试 user + user_role，并用
 * Node crypto 手动签发 HS256 JWT（secret 从 .env 读 JWT_SECRET），绕过微信登录。
 * admin token：prisma 查 seed 的 ADMIN userRole 拿 uid，签 JWT（role='ADMIN'）。
 *
 * 用法：
 *   cd G:/副业/仿校园小程序开发/project/apps/server
 *   node scripts/smoke-prod-redlines.mjs
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
    // 保留非 JSON 响应
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
  confessionPostIds: [],
  jobPostIds: [],
  paymentOrderIds: [],
  moderationRecordIds: [],
  circleIds: [],
};
let prismaRef = null;
let marker = '';
let mockOpenidPrefixes = [];
let jwtSecret = '';
let selfCreatedPricing = false; // 是否由本脚本新建 PricingConfig.D30（测完删除还原空状态）

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

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理本 smoke 创建的数据...');

  // 通过 openid 前缀重新发现已创建的 user id（避免中途断言失败残留）
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

  const markerJobPosts = await prisma.jobPost.findMany({
    where: {
      OR: [
        ...(merchantIds.length > 0 ? [{ merchantId: { in: merchantIds } }] : []),
        { title: { startsWith: `SmokeR4_${marker}` } },
        { title: { startsWith: `SmokeE4_${marker}` } },
      ],
    },
    select: { id: true },
  });
  const jobPostIds = [...new Set([...created.jobPostIds, ...markerJobPosts.map((row) => row.id)])];

  const markerConfPosts = await prisma.post.findMany({
    where: userIds.length > 0 ? { authorId: { in: userIds } } : { id: { in: [] } },
    select: { id: true },
  });
  const confessionPostIds = [...new Set([...created.confessionPostIds, ...markerConfPosts.map((row) => row.id)])];

  const allTargetIds = [...jobPostIds, ...confessionPostIds];
  const markerModRecords = await prisma.moderationRecord.findMany({
    where: allTargetIds.length > 0 ? { targetId: { in: allTargetIds } } : { id: { in: [] } },
    select: { id: true },
  });
  const modRecordIds = [...new Set([...created.moderationRecordIds, ...markerModRecords.map((row) => row.id)])];

  const markerOrders = await prisma.paymentOrder.findMany({
    where: {
      OR: [
        ...(jobPostIds.length > 0 ? [{ jobPostId: { in: jobPostIds } }] : []),
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

  // 子表先删；按 FK 反向顺序
  await deleteMany('notifications', () =>
    userIds.length > 0
      ? prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.notification.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('comments', () =>
    confessionPostIds.length > 0
      ? prisma.comment.deleteMany({ where: { postId: { in: confessionPostIds } } })
      : prisma.comment.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('post_likes', () =>
    confessionPostIds.length > 0
      ? prisma.postLike.deleteMany({ where: { postId: { in: confessionPostIds } } })
      : prisma.postLike.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('moderation_records', () =>
    modRecordIds.length > 0
      ? prisma.moderationRecord.deleteMany({ where: { id: { in: modRecordIds } } })
      : prisma.moderationRecord.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('payment_orders', () =>
    orderIds.length > 0
      ? prisma.paymentOrder.deleteMany({ where: { id: { in: orderIds } } })
      : prisma.paymentOrder.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('job_views', () =>
    jobPostIds.length > 0
      ? prisma.jobView.deleteMany({ where: { jobPostId: { in: jobPostIds } } })
      : prisma.jobView.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('job_applications', () =>
    jobPostIds.length > 0
      ? prisma.jobApplication.deleteMany({ where: { jobPostId: { in: jobPostIds } } })
      : prisma.jobApplication.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('job_posts', () =>
    jobPostIds.length > 0
      ? prisma.jobPost.deleteMany({ where: { id: { in: jobPostIds } } })
      : prisma.jobPost.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('posts (confession)', () =>
    confessionPostIds.length > 0
      ? prisma.post.deleteMany({ where: { id: { in: confessionPostIds } } })
      : prisma.post.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('merchants', () =>
    userIds.length > 0
      ? prisma.merchant.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.merchant.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('user_roles', () =>
    userIds.length > 0
      ? prisma.userRole.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.userRole.deleteMany({ where: { id: { in: [] } } }),
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
  // 自建 circle（若有）
  if (created.circleIds.length > 0) {
    await deleteMany('circles (self-created)', () =>
      prisma.circle.deleteMany({ where: { id: { in: created.circleIds } } }),
    );
  }

  // 逐表自验证：marker 查询确认无测试残留
  const remain = {
    users: mockOpenidPrefixes.length > 0
      ? await prisma.user.count({ where: { OR: mockOpenidPrefixes.map((prefix) => ({ openid: { startsWith: prefix } })) } })
      : 0,
    merchants: await prisma.merchant.count({ where: { userId: { in: userIds } } }),
    jobPosts: await prisma.jobPost.count({ where: jobPostIds.length > 0 ? { id: { in: jobPostIds } } : { id: { in: [] } } }),
    confessionPosts: await prisma.post.count({ where: confessionPostIds.length > 0 ? { id: { in: confessionPostIds } } : { id: { in: [] } } }),
    orders: await prisma.paymentOrder.count({ where: orderIds.length > 0 ? { id: { in: orderIds } } : { id: { in: [] } } }),
    modRecords: await prisma.moderationRecord.count({ where: modRecordIds.length > 0 ? { id: { in: modRecordIds } } : { id: { in: [] } } }),
    roles: await prisma.userRole.count({ where: { userId: { in: userIds } } }),
  };
  for (const [table, count] of Object.entries(remain)) {
    assert(count === 0, `清理自验证 ${table}=0`, `remain=${count}`);
  }
  console.log('[cleanup] 清理完成并逐表自验证为 0');
}

(async () => {
  console.log('[smoke-prod-redlines] BASE =', BASE);
  marker = `sprl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  jwtSecret = readJwtSecret();
  prismaRef = new (await import('@prisma/client')).PrismaClient({ datasources: { db: { url: DB } } });

  try {
    // ===== admin token：prisma 查 seed ADMIN userRole -> 签 JWT =====
    console.log('\n[admin token] prisma 查 seed ADMIN user');
    const adminRole = await prismaRef.userRole.findFirst({
      where: { role: 'ADMIN' },
      select: { userId: true },
    });
    assert(!!adminRole, 'seed ADMIN userRole 存在');
    const adminUser = await prismaRef.user.findUnique({ where: { id: adminRole.userId } });
    assert(!!adminUser, 'admin user 存在');
    const adminUid = adminUser.id;
    const adminToken = signJwt(
      { uid: adminUid, role: 'ADMIN', openid: adminUser.openid, type: 'access' },
      jwtSecret,
    );
    // 验证 admin JWT 可用
    const meResp = await call('GET', '/auth/me', adminToken);
    assert(
      meResp.status === 200 && meResp.body?.code === 0,
      'admin JWT 可用：GET /auth/me 成功',
      JSON.stringify(meResp.body),
    );
    // 验证 admin 能访问 /admin/pricing（AdminGuard 放行）
    const adminPricing = await call('GET', '/admin/pricing', adminToken);
    assert(adminPricing.body?.code === 0, 'admin token 可访问 /admin/pricing', JSON.stringify(adminPricing.body));

    // ===== E1 单价校验（updatePricing）=====
    console.log('\n[E1] 单价校验');
    // 确保 PricingConfig.D30 存在（seed 应已建；缺则自建 price=90，测完删除还原）
    let d30 = await prismaRef.pricingConfig.findUnique({ where: { duration: 'D30' } });
    if (!d30) {
      d30 = await prismaRef.pricingConfig.create({ data: { duration: 'D30', price: 90 } });
      selfCreatedPricing = true;
      console.log('  (PricingConfig.D30 缺失，已自建 price=90，测完将删除)');
    }
    const originalPrice = Number(d30.price);
    console.log(`  (D30 原价 = ${originalPrice}，测完将恢复)`);
    // GET /admin/pricing 验证 API 返 D30
    const pricingBefore = await call('GET', '/admin/pricing', adminToken);
    assert(pricingBefore.body?.code === 0, 'E1: GET /admin/pricing', JSON.stringify(pricingBefore.body));
    const d30Before = pricingBefore.body.data.find((p) => p.duration === 'D30');
    assert(!!d30Before, 'E1: GET /admin/pricing 含 D30 档位');
    assertEq(Number(d30Before.price), originalPrice, 'E1: GET 返回的 D30 价格与 DB 一致');

    // price=0 -> 业务错误 60004（DTO @Min(0) 放行 0，service 拦截）
    const r0 = await call('PUT', '/admin/pricing', adminToken, { duration: 'D30', price: 0 });
    assert(
      r0.body?.code === 60004,
      'E1: price=0 被拒 code=60004',
      `HTTP ${r0.status} ${JSON.stringify(r0.body)}`,
    );

    // price=-1 -> DTO @Min(0) 拒绝（HTTP 400）或 service 60004
    const rNeg = await call('PUT', '/admin/pricing', adminToken, { duration: 'D30', price: -1 });
    assert(
      rNeg.status === 400 || rNeg.body?.code === 60004,
      'E1: price=-1 被拒（HTTP 400 或 code=60004）',
      `HTTP ${rNeg.status} ${JSON.stringify(rNeg.body)}`,
    );

    // price=1 -> 成功
    const r1 = await call('PUT', '/admin/pricing', adminToken, { duration: 'D30', price: 1 });
    assert(r1.body?.code === 0, 'E1: price=1 成功 code=0', JSON.stringify(r1.body));

    // 恢复原价
    const rRestore = await call('PUT', '/admin/pricing', adminToken, { duration: 'D30', price: originalPrice });
    assert(rRestore.body?.code === 0, 'E1: 恢复原价成功', JSON.stringify(rRestore.body));
    // GET 复查原价已恢复
    const pricingAfter = await call('GET', '/admin/pricing', adminToken);
    const d30After = pricingAfter.body.data.find((p) => p.duration === 'D30');
    assertEq(Number(d30After.price), originalPrice, 'E1: D30 原价已恢复（GET 复查）');

    // ===== R5 getQueue userNickname 真实填充 =====
    console.log('\n[R5] getQueue userNickname 真实填充');
    const r5Openid = `mock_r5_${marker}`;
    mockOpenidPrefixes.push(r5Openid);
    const r5Nickname = `SmokeR5_${marker}`;
    const { user: r5User } = await createTestUser(prismaRef, r5Openid, r5Nickname, 'USER');
    created.userIds.push(r5User.id);
    const r5Merchant = await prismaRef.merchant.create({
      data: {
        userId: r5User.id,
        shopName: `R5店铺_${marker}`,
        licenseNo: `R5LIC_${marker}`,
        contactPhone: '13800000005',
        status: 'PENDING',
      },
    });
    created.merchantIds.push(r5Merchant.id);
    const queueResp = await call('GET', '/admin/queue', adminToken);
    assert(queueResp.body?.code === 0, 'R5: GET /admin/queue', JSON.stringify(queueResp.body));
    const found = queueResp.body.data.merchants.find((m) => m.id === r5Merchant.id);
    assert(!!found, 'R5: 队列含该商家');
    assert(
      found.userNickname === r5Nickname,
      'R5: userNickname 真实填充（非空、等于该 nickname）',
      `expected=${r5Nickname} actual=${JSON.stringify(found.userNickname)}`,
    );
    assert(found.userNickname !== '' && found.userNickname !== null, 'R5: userNickname 非空非""', `actual=${JSON.stringify(found.userNickname)}`);

    // ===== R1 表白墙帖子举报 reporterId =====
    console.log('\n[R1] 表白墙帖子举报 reporterId');
    const r1Openid = `mock_r1_${marker}`;
    mockOpenidPrefixes.push(r1Openid);
    const { user: r1User, token: r1Token } = await createTestUser(prismaRef, r1Openid, `SmokeR1_${marker}`, 'USER');
    created.userIds.push(r1User.id);
    // 查一个 circle（seed 应有；缺则自建，测完删）
    let circle = await prismaRef.circle.findFirst({});
    if (!circle) {
      circle = await prismaRef.circle.create({ data: { name: `R1Circle_${marker}` } });
      created.circleIds.push(circle.id);
      console.log('  (circle 缺失，已自建，测完将删除)');
    }
    const circleId = circle.id;
    // 创建帖子（content 含 marker 便于追溯）
    // 用 visibility=PRIVATE 绕过 checkText（需微信 access_token，dev 环境获取失败返 90003）；
    // PRIVATE 跳过内容审核但不影响举报契约（reportPost 仅校验帖子存在）
    const createPostResp = await call('POST', `/circles/${circleId}/posts`, r1Token, {
      content: `smoke test R1 ${marker}`,
      visibility: 'PRIVATE',
    });
    assert(createPostResp.body?.code === 0, 'R1: 创建帖子成功', JSON.stringify(createPostResp.body));
    const postId = createPostResp.body.data.id;
    created.confessionPostIds.push(postId);
    // 举报
    const reportResp = await call('POST', `/posts/${postId}/report`, r1Token, { reason: `smoke R1 ${marker}` });
    assert(reportResp.body?.code === 0, 'R1: 举报接口成功', JSON.stringify(reportResp.body));
    // admin 查举报列表
    const reportsResp = await call('GET', '/admin/reports?status=PENDING&pageSize=100', adminToken);
    assert(reportsResp.body?.code === 0, 'R1: GET /admin/reports', JSON.stringify(reportsResp.body));
    const rep = reportsResp.body.data.list.find((r) => r.targetType === 'post' && r.targetId === postId);
    assert(!!rep, 'R1: 举报列表含该帖举报（targetType=post, targetId=postId）');
    assert(
      rep.reporterId === r1User.id,
      'R1: reporterId 真实填充（非空、=== 该 user uid）',
      `expected=${r1User.id} actual=${JSON.stringify(rep.reporterId)}`,
    );
    // 记录 moderationRecord id 供 cleanup
    created.moderationRecordIds.push(rep.id);

    // ===== R4 岗位下架闭环（admin 主动）=====
    console.log('\n[R4] 岗位下架闭环（admin 主动）');
    const r4Openid = `mock_r4_${marker}`;
    mockOpenidPrefixes.push(r4Openid);
    const { user: r4User } = await createTestUser(prismaRef, r4Openid, `SmokeR4_${marker}`, 'MERCHANT');
    created.userIds.push(r4User.id);
    const r4Merchant = await prismaRef.merchant.create({
      data: {
        userId: r4User.id,
        shopName: `R4店铺_${marker}`,
        licenseNo: `R4LIC_${marker}`,
        contactPhone: '13800000004',
        status: 'APPROVED',
      },
    });
    created.merchantIds.push(r4Merchant.id);
    const r4JobPost = await prismaRef.jobPost.create({
      data: {
        merchantId: r4Merchant.id,
        title: `SmokeR4_${marker}`,
        description: 'R4 smoke 测试岗位',
        salary: '100/天',
        location: 'R4 测试地点',
        duration: 'D30',
        expireAt: new Date(Date.now() + 30 * 86_400_000),
        status: 'PUBLISHED',
      },
    });
    created.jobPostIds.push(r4JobPost.id);
    // admin takedown
    const tdResp = await call('POST', `/admin/job-posts/${r4JobPost.id}/takedown`, adminToken, {
      reason: `smoke 下架 ${marker}`,
    });
    assert(tdResp.body?.code === 0, 'R4: admin takedown 接口成功', JSON.stringify(tdResp.body));
    // DB 复查：jobPost.status=TAKEN_DOWN
    const jpAfter = await prismaRef.jobPost.findUnique({ where: { id: r4JobPost.id }, select: { status: true } });
    assertEq(jpAfter?.status, 'TAKEN_DOWN', 'R4: DB jobPost.status=TAKEN_DOWN');
    // DB 复查：ModerationRecord(targetType=job_post, targetId, status=REJECTED, reviewerId=adminUid)
    const modRec = await prismaRef.moderationRecord.findFirst({
      where: { targetType: 'job_post', targetId: r4JobPost.id },
    });
    assert(!!modRec, 'R4: 存在 ModerationRecord（targetType=job_post）');
    created.moderationRecordIds.push(modRec.id);
    assertEq(modRec.status, 'REJECTED', 'R4: ModerationRecord.status=REJECTED');
    assert(
      modRec.reviewerId === adminUid,
      'R4: ModerationRecord.reviewerId=adminUid',
      `expected=${adminUid} actual=${JSON.stringify(modRec.reviewerId)}`,
    );
    // DB 复查：商家 user 收到 Notification(type=post_takedown, targetType=job_post, targetId)
    const r4Note = await prismaRef.notification.findFirst({
      where: { userId: r4User.id, type: 'post_takedown', targetType: 'job_post', targetId: r4JobPost.id },
    });
    assert(!!r4Note, 'R4: 商家 user 收到 Notification(type=post_takedown, targetType=job_post, targetId)');

    // ===== E4 支付成功通知商家 =====
    console.log('\n[E4] 支付成功通知商家');
    const e4Openid = `mock_e4_${marker}`;
    mockOpenidPrefixes.push(e4Openid);
    const { user: e4User, token: e4Token } = await createTestUser(prismaRef, e4Openid, `SmokeE4_${marker}`, 'MERCHANT');
    created.userIds.push(e4User.id);
    const e4Merchant = await prismaRef.merchant.create({
      data: {
        userId: e4User.id,
        shopName: `E4店铺_${marker}`,
        licenseNo: `E4LIC_${marker}`,
        contactPhone: '13800000007',
        status: 'APPROVED',
      },
    });
    created.merchantIds.push(e4Merchant.id);
    const e4JobPost = await prismaRef.jobPost.create({
      data: {
        merchantId: e4Merchant.id,
        title: `SmokeE4_${marker}`,
        description: 'E4 smoke 测试岗位',
        salary: '100/天',
        location: 'E4 测试地点',
        duration: 'D30',
        expireAt: new Date(Date.now() + 30 * 86_400_000),
        status: 'PENDING',
      },
    });
    created.jobPostIds.push(e4JobPost.id);
    // payment job-publish（dev mock，WX_PAY 凭证不齐走 mock 直接 fulfill）
    const payResp = await call('POST', '/payments/job-publish', e4Token, {
      jobPostId: e4JobPost.id,
      duration: 'D30',
    });
    assert(payResp.body?.code === 0, 'E4: 付费发布接口成功', JSON.stringify(payResp.body));
    assertEq(payResp.body.data.status, 'PAID', 'E4: 返回 status=PAID');
    assertEq(payResp.body.data.jobPostStatus, 'PUBLISHED', 'E4: 返回 jobPostStatus=PUBLISHED');
    assertEq(payResp.body.data.wxPayParams, null, 'E4: 返回 wxPayParams=null（mock 路径）');
    // 查 PaymentOrder id
    const e4Order = await prismaRef.paymentOrder.findFirst({ where: { jobPostId: e4JobPost.id } });
    assert(!!e4Order, 'E4: PaymentOrder 存在');
    created.paymentOrderIds.push(e4Order.id);
    // DB 复查：PaymentOrder.status=PAID
    const e4OrderAfter = await prismaRef.paymentOrder.findUnique({
      where: { id: e4Order.id },
      select: { status: true },
    });
    assertEq(e4OrderAfter?.status, 'PAID', 'E4: DB PaymentOrder.status=PAID');
    // DB 复查：jobPost.status=PUBLISHED
    const e4JpAfter = await prismaRef.jobPost.findUnique({ where: { id: e4JobPost.id }, select: { status: true } });
    assertEq(e4JpAfter?.status, 'PUBLISHED', 'E4: DB jobPost.status=PUBLISHED');
    // DB 复查：商家 user 收到 Notification(type=payment_paid, targetType=job_post, targetId)
    const e4Note = await prismaRef.notification.findFirst({
      where: { userId: e4User.id, type: 'payment_paid', targetType: 'job_post', targetId: e4JobPost.id },
    });
    assert(!!e4Note, 'E4: 商家 user 收到 Notification(type=payment_paid, targetType=job_post, targetId)');

    console.log('\n[smoke-prod-redlines] ALL ASSERTIONS PASSED');
  } finally {
    await cleanup(prismaRef);
    await prismaRef.$disconnect();
  }
})().catch(async (error) => {
  console.error(`\n[smoke-prod-redlines] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  if (prismaRef) {
    try {
      await cleanup(prismaRef);
    } catch (cleanupError) {
      console.error('[cleanup] 清理失败:', cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
    }
    try {
      await prismaRef.$disconnect();
    } catch {
      // ignore
    }
  }
  process.exitCode = 1;
});
