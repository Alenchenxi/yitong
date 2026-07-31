/**
 * M4-02 报名处理提醒（懒检查版）独立 smoke
 *
 * 覆盖契约：
 * 1. 未带 token 401；普通 user token 可鉴权但无 Merchant 时 no-op
 * 2. 未入驻、未 APPROVED 商家 no-op 且不创建提醒
 * 3. 无待处理 / 未超时 / 已联系分支 no-op
 * 4. 超时未联系正常创建、24h 冷却去重
 * 5. STALE_THRESHOLD 边界（24h 前后各 2 秒）
 * 6. apply 分类列表与 unread-counts 联动
 * 7. contactedAt 置位后计数减少
 * 8. Notification.type 使用字符串 job_apply_reminder
 *
 * 用法：
 *   cd G:/副业/仿校园小程序开发/project/apps/server
 *   node scripts/smoke-m4-02-apply-reminder.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const HOUR = 3_600_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(code, nickname, role = 'user') {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
    });
    const body = await response.json();
    if (body.code === 0) return body.data;
    if (response.status === 429) {
      console.log(`  login 被限流，等待 14s（第 ${attempt + 1}/5 次）`);
      await sleep(14_000);
      continue;
    }
    throw new Error(`login ${role}: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  throw new Error(`login ${role}: 超过重试次数`);
}

async function call(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, {
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
  jobApplicationIds: [],
  paymentOrderIds: [],
  jobViewIds: [],
  notificationIds: [],
};
let prismaRef = null;
let marker = '';
let mockOpenidPrefixes = [];
let merchantUserId = '';
let studentUserId = '';
let merchantId = '';

function inList(values) {
  return values.length > 0 ? { in: values } : undefined;
}

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理本 smoke 创建的数据...');

  // 即使中途断言失败，也通过 marker 重新发现已创建的 id，避免残留。
  const markerUsers = await prisma.user.findMany({
    where: mockOpenidPrefixes.length > 0
      ? { OR: mockOpenidPrefixes.map((prefix) => ({ openid: { startsWith: prefix } })) }
      : { id: { in: [] } },
    select: { id: true },
  });
  const userIds = [...new Set([...created.userIds, ...markerUsers.map((row) => row.id)])];

  const markerMerchants = await prisma.merchant.findMany({
    where: { userId: inList(userIds) },
    select: { id: true },
  });
  const merchantIds = [...new Set([...created.merchantIds, ...markerMerchants.map((row) => row.id)])];

  const markerPosts = await prisma.jobPost.findMany({
    where: {
      OR: [
        ...(merchantIds.length > 0 ? [{ merchantId: { in: merchantIds } }] : []),
        { title: { startsWith: `M4-02_${marker}` } },
      ],
    },
    select: { id: true },
  });
  const postIds = [...new Set([...created.jobPostIds, ...markerPosts.map((row) => row.id)])];

  const appRows = await prisma.jobApplication.findMany({
    where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { id: { in: [] } },
    select: { id: true },
  });
  const appIds = [...new Set([...created.jobApplicationIds, ...appRows.map((row) => row.id)])];

  const deleteMany = async (label, operation) => {
    const result = await operation();
    console.log(`  ${label}: ${result.count}`);
    return result.count;
  };

  // 子表先删；UserRole 无 onDelete Cascade，必须在 User 前删除。
  await deleteMany('job_reviews', () =>
    appIds.length > 0
      ? prisma.jobReview.deleteMany({ where: { applicationId: { in: appIds } } })
      : prisma.jobReview.deleteMany({ where: { applicationId: { in: [] } } }),
  );
  await deleteMany('job_views', () =>
    postIds.length > 0
      ? prisma.jobView.deleteMany({ where: { jobPostId: { in: postIds } } })
      : prisma.jobView.deleteMany({ where: { jobPostId: { in: [] } } }),
  );
  await deleteMany('job_applications', () =>
    postIds.length > 0
      ? prisma.jobApplication.deleteMany({ where: { jobPostId: { in: postIds } } })
      : prisma.jobApplication.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('payment_orders', () =>
    postIds.length > 0
      ? prisma.paymentOrder.deleteMany({ where: { jobPostId: { in: postIds } } })
      : prisma.paymentOrder.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('notifications', () =>
    userIds.length > 0
      ? prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.notification.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('job_posts', () =>
    postIds.length > 0
      ? prisma.jobPost.deleteMany({ where: { id: { in: postIds } } })
      : prisma.jobPost.deleteMany({ where: { id: { in: [] } } }),
  );
  await deleteMany('merchants', () =>
    userIds.length > 0
      ? prisma.merchant.deleteMany({ where: { userId: { in: userIds } } })
      : prisma.merchant.deleteMany({ where: { id: { in: [] } } }),
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

  // 清理后逐表自验证；marker 查询也覆盖脚本异常时未收集到的 id。
  const remain = {
    users: mockOpenidPrefixes.length > 0
      ? await prisma.user.count({ where: { OR: mockOpenidPrefixes.map((prefix) => ({ openid: { startsWith: prefix } })) } })
      : 0,
    merchants: await prisma.merchant.count({ where: { userId: { in: userIds } } }),
    posts: await prisma.jobPost.count({ where: postIds.length > 0 ? { id: { in: postIds } } : { id: { in: [] } } }),
    applications: await prisma.jobApplication.count({ where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { id: { in: [] } } }),
    orders: await prisma.paymentOrder.count({ where: postIds.length > 0 ? { jobPostId: { in: postIds } } : { id: { in: [] } } }),
    notifications: await prisma.notification.count({ where: { userId: { in: userIds } } }),
    roles: await prisma.userRole.count({ where: { userId: { in: userIds } } }),
  };
  for (const [table, count] of Object.entries(remain)) {
    assert(count === 0, `清理自验证 ${table}=0`, `remain=${count}`);
  }
  console.log('[cleanup] 清理完成并逐表自验证为 0');
}

async function createPublishedPost(token, title) {
  const createdPost = await call('POST', '/job-posts', token, {
    title,
    description: 'M4-02 smoke 测试岗位描述',
    salary: '100/天',
    location: 'M4-02 测试地点',
    category: 'CATERING',
    settlement: 'DAILY',
    workDates: ['周六'],
    workPeriods: ['全天'],
    headcount: 10,
    questions: [],
    duration: 'D30',
  });
  assert(createdPost.body?.code === 0, '创建测试岗位成功', JSON.stringify(createdPost.body));
  const postId = createdPost.body.data.id;
  created.jobPostIds.push(postId);

  const published = await call('POST', '/payments/job-publish', token, {
    jobPostId: postId,
    duration: 'D30',
  });
  assert(published.body?.code === 0, 'dev mock 付费发布岗位成功', JSON.stringify(published.body));
  if (published.body?.data?.orderId) created.paymentOrderIds.push(published.body.data.orderId);
  return postId;
}

async function createApplication(token, postId, { ageMs = null, contacted = false } = {}) {
  const response = await call('POST', `/job-posts/${postId}/applications`, token, {});
  assert(response.body?.code === 0, '创建 PENDING 报名成功', JSON.stringify(response.body));
  const appId = response.body.data.id;
  created.jobApplicationIds.push(appId);

  if (ageMs !== null || contacted) {
    const data = {};
    if (ageMs !== null) data.createdAt = new Date(Date.now() - ageMs);
    if (contacted) data.contactedAt = new Date();
    await prismaRef.jobApplication.update({ where: { id: appId }, data });
  }
  return appId;
}

async function currentStaleCount() {
  return prismaRef.jobApplication.count({
    where: {
      status: 'PENDING',
      contactedAt: null,
      createdAt: { lt: new Date(Date.now() - 24 * HOUR) },
      jobPost: { merchantId },
    },
  });
}

(async () => {
  console.log('[m4-02 apply-reminder smoke] BASE =', BASE);
  marker = `m402_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const codePrefix = marker.slice(0, 8);
  const { PrismaClient } = await import('@prisma/client');
  prismaRef = new PrismaClient({ datasources: { db: { url: DB } } });

  try {
    // 两次登录足够覆盖普通用户与商家，且前 8 个字符必须不同（dev mock openid 截取 code 前 8 位）。
    const merchantCode = `${marker.slice(0, 7)}M${marker}`;
    const studentCode = `${marker.slice(0, 7)}S${marker}`;
    mockOpenidPrefixes = [`mock_${merchantCode.slice(0, 8)}`, `mock_${studentCode.slice(0, 8)}`];
    const merchantLogin = await login(merchantCode, `M4-02商家_${marker}`, 'merchant');
    merchantUserId = merchantLogin.user.id;
    created.userIds.push(merchantUserId);
    const studentLogin = await login(studentCode, `M4-02学生_${marker}`, 'user');
    studentUserId = studentLogin.user.id;
    created.userIds.push(studentUserId);

    // 1a. 未带 token -> 401。
    const noToken = await call('POST', '/merchant/apply-reminder', null);
    assertEq(noToken.status, 401, '验证点1：未带 token 返回 HTTP 401', JSON.stringify(noToken.body));

    // 1b + 2. 普通用户 token 鉴权通过，但未入驻 no-op 且不产生通知。
    const beforeUnregistered = await prismaRef.notification.count({ where: { userId: studentUserId } });
    const unregistered = await call('POST', '/merchant/apply-reminder', studentLogin.accessToken);
    assert(unregistered.status === 200 || unregistered.status === 201, '验证点1：user role token 鉴权通过', `HTTP ${unregistered.status}`);
    assertEq(unregistered.body?.code, 0, '验证点1：user role 响应 code=0');
    assertEq(unregistered.body?.data, { created: false, count: 0 }, '验证点2：未入驻商家 no-op');
    const afterUnregistered = await prismaRef.notification.count({ where: { userId: studentUserId } });
    assertEq(afterUnregistered, beforeUnregistered, '验证点2：未入驻不创建 Notification');

    // 商家入驻，dev 自动 APPROVED。
    const registration = await call('POST', '/merchant/register', merchantLogin.accessToken, {
      shopName: `M4-02店铺_${marker}`,
      licenseNo: `M402LIC_${marker}`,
      contactPhone: '13800000002',
    });
    assert(registration.body?.code === 0, '创建并注册测试商家成功', JSON.stringify(registration.body));
    const profile = await call('GET', '/merchant/profile', merchantLogin.accessToken);
    assert(profile.body?.code === 0, '读取测试商家 profile 成功');
    merchantId = profile.body.data.id;
    created.merchantIds.push(merchantId);
    assertEq(profile.body.data.status, 'APPROVED', '测试商家 dev 状态为 APPROVED');

    // 未 APPROVED 分支：暂时改为 PENDING，调用后恢复。
    await prismaRef.merchant.update({ where: { id: merchantId }, data: { status: 'PENDING' } });
    const beforeNotApproved = await prismaRef.notification.count({ where: { userId: merchantUserId } });
    const notApproved = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(notApproved.body?.data, { created: false, count: 0 }, '额外分支：未 APPROVED 商家 no-op');
    const afterNotApproved = await prismaRef.notification.count({ where: { userId: merchantUserId } });
    assertEq(afterNotApproved, beforeNotApproved, '额外分支：未 APPROVED 不创建 Notification');
    await prismaRef.merchant.update({ where: { id: merchantId }, data: { status: 'APPROVED' } });

    // 3. APPROVED 商家但没有报名 -> no-op。
    const noPending = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(noPending.body?.data, { created: false, count: 0 }, '验证点3：PENDING 报名数为 0 no-op');

    // 4. 24h 内新报名 -> no-op。
    const recentPost = await createPublishedPost(merchantLogin.accessToken, `M4-02_recent_${marker}`);
    await createApplication(studentLogin.accessToken, recentPost);
    const recentResult = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(recentResult.body?.data, { created: false, count: 0 }, '验证点4：全为 24h 内 PENDING no-op');

    // 5. 超时但已联系 -> no-op（同时保留 recent，二者都不应计入）。
    const contactedPost = await createPublishedPost(merchantLogin.accessToken, `M4-02_contacted_${marker}`);
    const contactedAppId = await createApplication(studentLogin.accessToken, contactedPost, {
      ageMs: 25 * HOUR,
      contacted: true,
    });
    const contactedResult = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(contactedResult.body?.data, { created: false, count: 0 }, '验证点5：超时但 contactedAt 非空 no-op');

    // 6. 正常创建 + 阈值边界：两条明显超时、一条早于阈值 2s、一条晚于阈值 2s。
    const staleAppIds = [];
    for (const label of ['stale_a', 'stale_b']) {
      const postId = await createPublishedPost(merchantLogin.accessToken, `M4-02_${label}_${marker}`);
      staleAppIds.push(await createApplication(studentLogin.accessToken, postId, { ageMs: 25 * HOUR }));
    }
    const oldBoundaryPost = await createPublishedPost(merchantLogin.accessToken, `M4-02_boundary_old_${marker}`);
    const oldBoundaryAppId = await createApplication(studentLogin.accessToken, oldBoundaryPost, { ageMs: 24 * HOUR + 2_000 });
    staleAppIds.push(oldBoundaryAppId);
    const newBoundaryPost = await createPublishedPost(merchantLogin.accessToken, `M4-02_boundary_new_${marker}`);
    const newBoundaryAppId = await createApplication(studentLogin.accessToken, newBoundaryPost, { ageMs: 24 * HOUR - 2_000 });

    const expectedBeforeCreate = await currentStaleCount();
    assert(expectedBeforeCreate === 3, '边界：早于 24h 阈值 2s 的报名计入、晚于阈值 2s 的不计入', `expected stale count=${expectedBeforeCreate} oldBoundary=${oldBoundaryAppId} newBoundary=${newBoundaryAppId}`);
    const firstReminder = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(firstReminder.body?.data, { created: true, count: expectedBeforeCreate }, '验证点6：正常情况首次创建提醒');

    const reminder = await prismaRef.notification.findFirst({
      where: { userId: merchantUserId, type: 'job_apply_reminder' },
      orderBy: { createdAt: 'desc' },
    });
    assert(reminder !== null, '验证点6：DB 存在 job_apply_reminder');
    created.notificationIds.push(...(reminder ? [reminder.id] : []));
    assertEq(reminder?.userId, merchantUserId, '验证点6：通知 userId 为商家 uid');
    assertEq(reminder?.type, 'job_apply_reminder', '验证点10：Notification.type 字符串值正确');
    assertEq(reminder?.title, '报名处理提醒', '验证点6：通知 title 正确');
    assert(reminder?.content.includes(`${expectedBeforeCreate}`), '验证点6：通知 content 含超时报名数 N', reminder?.content ?? '');
    assertEq(reminder?.targetType, 'merchant_candidates', '验证点6：targetType 正确');
    assertEq(reminder?.targetId, merchantId, '验证点6：targetId 为 merchant.id');

    // 7. 冷却窗内再次调用：count 重新计算但不再创建。
    const beforeCooldownRows = await prismaRef.notification.count({ where: { userId: merchantUserId, type: 'job_apply_reminder' } });
    const cooldown = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(cooldown.body?.data, { created: false, count: expectedBeforeCreate }, '验证点7：24h 冷却命中返回 created=false,count=N');
    const afterCooldownRows = await prismaRef.notification.count({ where: { userId: merchantUserId, type: 'job_apply_reminder' } });
    assertEq(afterCooldownRows, beforeCooldownRows, '验证点7：冷却命中不新增提醒（仍 1 条）');

    // 8. M4-01 联动：apply 分类返回提醒，unread-counts.apply 至少为 1。
    const applyNotifications = await call('GET', '/notifications?category=apply', merchantLogin.accessToken);
    assertEq(applyNotifications.status, 200, '验证点8：GET /notifications?category=apply HTTP 200');
    assert(applyNotifications.body?.code === 0, '验证点8：apply 分类 code=0');
    const applyList = applyNotifications.body?.data?.list ?? [];
    assert(applyList.some((item) => item.id === reminder.id && item.type === 'job_apply_reminder'), '验证点8：apply 列表包含提醒通知');
    const unreadCounts = await call('GET', '/notifications/unread-counts', merchantLogin.accessToken);
    assertEq(unreadCounts.status, 200, '验证点8：GET /notifications/unread-counts HTTP 200');
    assert(Number(unreadCounts.body?.data?.apply) >= 1, '验证点8：unread-counts.apply >= 1', JSON.stringify(unreadCounts.body?.data));

    // 9. 将一个超时报名置 contactedAt=now，计数应减 1；冷却仍阻止新建。
    const appToContact = staleAppIds[0];
    assert(typeof appToContact === 'string', '验证点9：存在可置位 contactedAt 的超时报名');
    await prismaRef.jobApplication.update({ where: { id: appToContact }, data: { contactedAt: new Date() } });
    const expectedAfterContact = await currentStaleCount();
    assertEq(expectedAfterContact, expectedBeforeCreate - 1, '验证点9：置位 contactedAt 后超时计数减 1');
    const afterContact = await call('POST', '/merchant/apply-reminder', merchantLogin.accessToken);
    assertEq(afterContact.body?.data, { created: false, count: expectedAfterContact }, '验证点9：置位 contactedAt 后返回减少后的 count');
    const rowsAfterContact = await prismaRef.notification.count({ where: { userId: merchantUserId, type: 'job_apply_reminder' } });
    assertEq(rowsAfterContact, 1, '验证点9：冷却内仍只有 1 条提醒');

    // 10. 直接 Prisma 字符串查询，确认不是 enum/别名。
    const stringLookup = await prismaRef.notification.findFirst({
      where: { type: 'job_apply_reminder', userId: merchantUserId },
      select: { id: true, type: true },
    });
    assert(stringLookup !== null, '验证点10：Prisma findFirst(type=job_apply_reminder) 可查到');
    assertEq(stringLookup?.type, 'job_apply_reminder', '验证点10：查到的 type 为字符串字面量');

    console.log('\n[m4-02 apply-reminder smoke] ALL ASSERTIONS PASSED');
  } finally {
    await cleanup(prismaRef);
    await prismaRef.$disconnect();
  }
})().catch(async (error) => {
  console.error(`\n[m4-02 apply-reminder smoke] FAILED: ${error instanceof Error ? error.message : String(error)}`);
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
