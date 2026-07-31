/**
 * M3-04/M3-05 岗位编辑 + 主动下架 smoke
 * 覆盖：
 *   PUT  /api/v1/job-posts/:id        （编辑：状态机 + 权限 + PUBLISHED 回退 PENDING）
 *   POST /api/v1/job-posts/:id/take-down （主动下架：仅 PUBLISHED + 权限 + takenDownAt）
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3000 + docker postgres。
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
globalThis.__sfx = '';
let prismaRef = null;

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理测试数据...');
  // FK 顺序：PaymentOrder -> JobView -> JobApplication -> JobReview -> Notification -> JobPost -> Merchant -> User
  const postIds = created.jobPostIds;
  const uids = created.userIds;

  // 1) PaymentOrder（按 jobPostId）
  let r = await prisma.paymentOrder.deleteMany({ where: { jobPostId: { in: postIds } } });
  console.log(`  payment_orders deleteMany: ${r.count}`);

  // 2) JobView（按 jobPostId）
  r = await prisma.jobView.deleteMany({ where: { jobPostId: { in: postIds } } });
  console.log(`  job_views deleteMany: ${r.count}`);

  // 3) JobReview（按 application -> jobPostId；先查 applications）
  const apps = await prisma.jobApplication.findMany({ where: { jobPostId: { in: postIds } }, select: { id: true } });
  if (apps.length) {
    r = await prisma.jobReview.deleteMany({ where: { applicationId: { in: apps.map((a) => a.id) } } });
    console.log(`  job_reviews deleteMany: ${r.count}`);
  }

  // 4) JobApplication（按 jobPostId）
  r = await prisma.jobApplication.deleteMany({ where: { jobPostId: { in: postIds } } });
  console.log(`  job_applications deleteMany: ${r.count}`);

  // 5) Notification（按 userId）
  r = await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  notifications deleteMany: ${r.count}`);

  // 6) JobPost（按 id）
  r = await prisma.jobPost.deleteMany({ where: { id: { in: postIds } } });
  console.log(`  job_posts deleteMany: ${r.count}`);

  // 7) Merchant（按 userId）
  r = await prisma.merchant.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  merchants deleteMany: ${r.count}`);

  // 7.5) UserRole（按 userId；wx-login + merchant register 会写 user_roles，FK 无级联，须先删）
  r = await prisma.userRole.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  user_roles deleteMany: ${r.count}`);

  // 8) User（按 id）
  r = await prisma.user.deleteMany({ where: { id: { in: uids } } });
  console.log(`  users deleteMany: ${r.count}`);

  // 自验证：复查目标表
  const remainPosts = await prisma.jobPost.findMany({ where: { id: { in: postIds } }, select: { id: true } });
  const remainUsers = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true } });
  const remainMerchants = await prisma.merchant.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  const remainOrders = await prisma.paymentOrder.findMany({ where: { jobPostId: { in: postIds } }, select: { id: true } });
  const remainRoles = await prisma.userRole.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  assert(remainPosts.length === 0, `自验证: job_posts 无残留 (剩 ${remainPosts.length})`);
  assert(remainUsers.length === 0, `自验证: users 无残留 (剩 ${remainUsers.length})`);
  assert(remainMerchants.length === 0, `自验证: merchants 无残留 (剩 ${remainMerchants.length})`);
  assert(remainOrders.length === 0, `自验证: payment_orders 无残留 (剩 ${remainOrders.length})`);
  assert(remainRoles.length === 0, `自验证: user_roles 无残留 (剩 ${remainRoles.length})`);
  console.log('[cleanup] 清理完成并自验证通过');
}

(async () => {
  console.log('[m3-04/05 job-edit-takedown smoke] base =', BASE);
  const sfx = `m3e${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  globalThis.__sfx = sfx;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  prismaRef = prisma;

  try {
    // 1) 登录 2 个商家：A（岗位 owner）、B（隔离用，非 owner）
    const A = await login(`MA${sfx}`, `MerchantA_${sfx}`, 'merchant');
    created.userIds.push(A.user.id);
    await sleep(14000); // 限流 5/min
    const B = await login(`MB${sfx}`, `MerchantB_${sfx}`, 'merchant');
    created.userIds.push(B.user.id);

    // 2) A / B 入驻（dev 自动 APPROVED + MERCHANT 角色）
    const regA = await call('POST', '/merchant/register', A.accessToken, {
      shopName: `店铺A_${sfx}`, licenseNo: `LICA${sfx}`, contactPhone: '13800000001',
    });
    assert(regA.body.code === 0, 'A 入驻成功');
    const mA = await call('GET', '/merchant/profile', A.accessToken);
    created.merchantIds.push(mA.body.data.id);
    const regB = await call('POST', '/merchant/register', B.accessToken, {
      shopName: `店铺B_${sfx}`, licenseNo: `LICB${sfx}`, contactPhone: '13800000002',
    });
    assert(regB.body.code === 0, 'B 入驻成功');
    const mB = await call('GET', '/merchant/profile', B.accessToken);
    created.merchantIds.push(mB.body.data.id);

    // 辅助：发岗（PENDING）
    async function createPost(token, title) {
      const r = await call('POST', '/job-posts', token, {
        title, description: 'm3-04 测试岗位描述', salary: '100/天', location: '校',
        category: 'CATERING', settlement: 'DAILY', workDates: ['周六'], workPeriods: ['全天'],
        headcount: 2, questions: ['你的身份'], duration: 'D30',
      });
      assert(r.body.code === 0, `发岗成功: ${title} ${JSON.stringify(r.body).slice(0, 80)}`);
      created.jobPostIds.push(r.body.data.id);
      return r.body.data;
    }
    // 辅助：付费发布（dev mock -> PUBLISHED），收集 PaymentOrder
    async function payPublish(token, postId) {
      const r = await call('POST', '/payments/job-publish', token, { jobPostId: postId, duration: 'D30' });
      assert(r.body.code === 0, `付费发布成功: ${postId}`);
      const orders = await prisma.paymentOrder.findMany({ where: { jobPostId: postId }, select: { id: true } });
      created.paymentOrderIds.push(...orders.map((o) => o.id));
      return r.body.data;
    }

    // 3) 造岗
    const pPending = await createPost(A.accessToken, `PENDING岗_${sfx}`);   // PENDING（编辑用）
    const pPub = await createPost(A.accessToken, `PUB岗_${sfx}`);           // -> 付费发布 PUBLISHED（编辑回退用）
    await payPublish(A.accessToken, pPub.id);
    const pPub2 = await createPost(A.accessToken, `PUB2岗_${sfx}`);         // -> 付费发布 PUBLISHED（下架用）
    await payPublish(A.accessToken, pPub2.id);
    const pPending2 = await createPost(A.accessToken, `PENDING2岗_${sfx}`); // PENDING（下架非法流转用）
    const pTakenDown = await createPost(A.accessToken, `TD岗_${sfx}`);      // -> 直接置 TAKEN_DOWN（编辑非法用）
    await prisma.jobPost.update({ where: { id: pTakenDown.id }, data: { status: 'TAKEN_DOWN', takenDownAt: new Date() } });

    const bPub = await createPost(B.accessToken, `BPUB岗_${sfx}`);          // B 的 PUBLISHED 岗（非 owner 隔离用）
    await payPublish(B.accessToken, bPub.id);

    // 确认初始状态
    assertEq(pPending.status, 'PENDING', 'pPending 初始 PENDING');
    const pubRefresh = await call('GET', `/job-posts/${pPub.id}`, A.accessToken);
    assertEq(pubRefresh.body.data.status, 'PUBLISHED', 'pPub 初始 PUBLISHED');
    const pub2Refresh = await call('GET', `/job-posts/${pPub2.id}`, A.accessToken);
    assertEq(pub2Refresh.body.data.status, 'PUBLISHED', 'pPub2 初始 PUBLISHED');
    // 收集 recordView 产生的 JobView（GET /job-posts/:id 会触发）
    const views = await prisma.jobView.findMany({ where: { jobPostId: { in: [pPub.id, pPub2.id] } }, select: { id: true } });
    created.jobViewIds.push(...views.map((v) => v.id));

    // ===== M3-04 编辑岗位验证 =====
    console.log('\n--- M3-04 编辑岗位 ---');

    // 验证点 1：A 编辑自己 PENDING 岗位 -> 成功，字段更新，duration 不变
    const edit1 = await call('PUT', `/job-posts/${pPending.id}`, A.accessToken, {
      title: `已编辑_${sfx}`, salary: '200/天', headcount: 5,
    });
    assert(edit1.body.code === 0, `编辑 PENDING 成功 ${JSON.stringify(edit1.body).slice(0, 100)}`);
    assertEq(edit1.body.data.title, `已编辑_${sfx}`, '编辑后 title 更新');
    assertEq(edit1.body.data.salary, '200/天', '编辑后 salary 更新');
    assertEq(edit1.body.data.headcount, 5, '编辑后 headcount 更新');
    assertEq(edit1.body.data.status, 'PENDING', '编辑 PENDING 后状态不变 PENDING');
    assertEq(edit1.body.data.duration, 'D30', '编辑后 duration 不可改（仍 D30）');

    // 验证点 2：A 编辑自己 PUBLISHED 岗位 -> 成功，状态回退 PENDING，needsRepublish=true
    const edit2 = await call('PUT', `/job-posts/${pPub.id}`, A.accessToken, {
      description: `已编辑描述_${sfx}`, location: `新地点_${sfx}`,
    });
    assert(edit2.body.code === 0, `编辑 PUBLISHED 成功 ${JSON.stringify(edit2.body).slice(0, 100)}`);
    assertEq(edit2.body.data.status, 'PENDING', '编辑 PUBLISHED 后回退 PENDING');
    assertEq(edit2.body.data.needsRepublish, true, 'needsRepublish=true');
    assertEq(edit2.body.data.editedFromStatus, 'PUBLISHED', 'editedFromStatus=PUBLISHED');
    assertEq(edit2.body.data.description, `已编辑描述_${sfx}`, '编辑后 description 更新');

    // 验证点 3：A 编辑自己 TAKEN_DOWN 岗位 -> 40003
    const edit3 = await call('PUT', `/job-posts/${pTakenDown.id}`, A.accessToken, { title: `尝试改_${sfx}` });
    assertEq(edit3.status, 409, `编辑 TAKEN_DOWN HTTP 409 got=${edit3.status}`);
    assertEq(edit3.body.code, 40003, `编辑 TAKEN_DOWN code 40003`);

    // 验证点 4：非本人编辑 -> 10003（B 编辑 A 的 pPending）
    const edit4 = await call('PUT', `/job-posts/${pPending.id}`, B.accessToken, { title: `B尝试改_${sfx}` });
    assertEq(edit4.status, 403, `非本人编辑 HTTP 403 got=${edit4.status}`);
    assertEq(edit4.body.code, 10003, `非本人编辑 code 10003`);

    // 验证点 5：编辑不存在岗位 -> 40001
    const edit5 = await call('PUT', `/job-posts/notexist_${sfx}`, A.accessToken, { title: `不存在_${sfx}` });
    assertEq(edit5.status, 404, `编辑不存在 HTTP 404 got=${edit5.status}`);
    assertEq(edit5.body.code, 40001, `编辑不存在 code 40001`);

    // 额外：duration 字段不可改（forbidNonWhitelisted -> 400）
    const editDur = await call('PUT', `/job-posts/${pPending.id}`, A.accessToken, { duration: 'D90' });
    assert(editDur.status === 400, `编辑传 duration HTTP 400 (forbidNonWhitelisted) got=${editDur.status}`);

    // ===== M3-05 主动下架验证 =====
    console.log('\n--- M3-05 主动下架 ---');

    // 验证点 6：A 下架自己 PUBLISHED 岗位 -> 成功，status=TAKEN_DOWN，takenDownAt 非空
    const td1 = await call('POST', `/job-posts/${pPub2.id}/take-down`, A.accessToken);
    assert(td1.body.code === 0, `下架 PUBLISHED 成功 ${JSON.stringify(td1.body).slice(0, 100)}`);
    assertEq(td1.body.data.status, 'TAKEN_DOWN', '下架后 status=TAKEN_DOWN');
    assert(td1.body.data.takenDownAt !== null && td1.body.data.takenDownAt !== undefined, `下架后 takenDownAt 非空 got=${td1.body.data.takenDownAt}`);

    // 验证点 7：A 下架自己 PENDING 岗位 -> 40004（状态非法流转）
    const td2 = await call('POST', `/job-posts/${pPending2.id}/take-down`, A.accessToken);
    assertEq(td2.status, 409, `下架 PENDING HTTP 409 got=${td2.status}`);
    assertEq(td2.body.code, 40004, `下架 PENDING code 40004`);

    // 验证点 8：A 下架非本人岗位（B 的 bPub）-> 10003
    const td3 = await call('POST', `/job-posts/${bPub.id}/take-down`, A.accessToken);
    assertEq(td3.status, 403, `下架非本人 HTTP 403 got=${td3.status}`);
    assertEq(td3.body.code, 10003, `下架非本人 code 10003`);

    // 额外：下架不存在岗位 -> 40001
    const td4 = await call('POST', `/job-posts/notexist_${sfx}/take-down`, A.accessToken);
    assertEq(td4.status, 404, `下架不存在 HTTP 404 got=${td4.status}`);
    assertEq(td4.body.code, 40001, `下架不存在 code 40001`);

    // 额外：下架已下架岗位（幂等报错）-> 40004（pPub2 已 TAKEN_DOWN）
    const td5 = await call('POST', `/job-posts/${pPub2.id}/take-down`, A.accessToken);
    assertEq(td5.status, 409, `重复下架 HTTP 409 got=${td5.status}`);
    assertEq(td5.body.code, 40004, `重复下架 code 40004`);

    console.log('\n[m3-04/05 job-edit-takedown smoke] ALL PASSED');
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
})().catch(async (e) => {
  console.error('\n[m3-04/05 job-edit-takedown smoke] STOPPED:', e.message);
  if (prismaRef) {
    try { await cleanup(prismaRef); } catch (ce) { console.error('[cleanup] 清理异常:', ce.message); }
    try { await prismaRef.$disconnect(); } catch {}
  }
  process.exit(1);
});
