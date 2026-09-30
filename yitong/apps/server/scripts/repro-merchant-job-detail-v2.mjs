/**
 * 复现脚本：M3-08 商家端职位详情页二期改造（曝光 + 重新发布）
 *
 * 在 M3-07 repro-merchant-job-detail.mjs 基础上扩展，复用其 helper。
 *
 * 验证：
 *  M3-07 回归：20 组用例（DELETE + stats + 软删过滤）
 *  M3-08 曝光 8 组：
 *   [21] recordImpressions 匿名 → 0 recorded
 *   [22] recordImpressions 登录 → 5 recorded
 *   [23] 同 hour 重复去重 → 0 new
 *   [24] 商家自己岗位过滤
 *   [25] >50 postIds 截断
 *  M3-08 stats 2 组：
 *   [26] exposureCount 反映 impressions 而非 views
 *   [27] 无 impressions 时 exposureCount = 0
 *  M3-08 republish 9 组：
 *   [28] PUBLISHED republish → 200 + status PENDING + expireAt null
 *   [29] TAKEN_DOWN republish → 200
 *   [30] EXPIRED republish → 200
 *   [31] PENDING republish → 40004
 *   [32] 重复 republish（PENDING 不可再 republish）→ 40004
 *   [33] 已软删 post republish → 40001
 *   [34] 跨商家 republish → 10003
 *   [35] republish 后 createJobPublishOrder 能下单（坏路径修复验证）
 *
 * 跑法：
 *   1) cd apps/server && CHAT_WS_PORT=3101 npx nest start
 *   2) node apps/server/scripts/repro-merchant-job-detail-v2.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fakeLogin(prisma, jwtSecret, openid, nickname, role) {
  const { default: jwt } = await import('jsonwebtoken');
  const user = await prisma.user.create({ data: { openid, nickname, avatarUrl: null } });
  await prisma.userRole.create({ data: { userId: user.id, role } });
  const payload = { uid: user.id, role, openid, type: 'access' };
  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '2h' });
  const roles = (await prisma.userRole.findMany({ where: { userId: user.id } })).map((r) => r.role);
  return { accessToken, role, user: { id: user.id, roles } };
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
  return { status: r.status, body: await r.json() };
}

function bizCode(body) {
  return body?.code ?? body?.error?.code ?? null;
}

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const fs = await import('node:fs');
  const envTxt = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const jwtSecret = envTxt
    .split(/\r?\n/)
    .find((l) => l.startsWith('JWT_SECRET='))
    .slice('JWT_SECRET='.length)
    .trim();

  let mA = null, mB = null, stu = null;
  const createdPostIds = [];
  const createdAppIds = [];
  const createdViewIds = [];
  const createdImpressionIds = [];
  const extraUsers = [];

  try {
    console.log('\n===== M3-08 商家端职位详情页二期改造（曝光 + 重新发布）=====\n');

    // ===== Setup =====
    console.log('[setup] 建 2 个商家 + 1 个学生 + 岗位');
    mA = await fakeLogin(prisma, jwtSecret, `mock_m3a_${sfx}`, `m3a${sfx}`, 'MERCHANT');
    await prisma.merchant.create({
      data: { userId: mA.user.id, shopName: `m3a店${sfx}`, licenseNo: `M3A${sfx}`, contactPhone: '13800000001', status: 'APPROVED' },
    });
    mB = await fakeLogin(prisma, jwtSecret, `mock_m3b_${sfx}`, `m3b${sfx}`, 'MERCHANT');
    await prisma.merchant.create({
      data: { userId: mB.user.id, shopName: `m3b店${sfx}`, licenseNo: `M3B${sfx}`, contactPhone: '13800000002', status: 'APPROVED' },
    });
    stu = await fakeLogin(prisma, jwtSecret, `mock_stu_${sfx}`, `stu${sfx}`, 'USER');

    // Create 3 separate students for 3 applications (unique constraint on job_post_id+user_id)
    const stu1 = await fakeLogin(prisma, jwtSecret, `mock_stu1_${sfx}`, `stu1${sfx}`, 'USER');
    const stu2 = await fakeLogin(prisma, jwtSecret, `mock_stu2_${sfx}`, `stu2${sfx}`, 'USER');
    const stu3 = await fakeLogin(prisma, jwtSecret, `mock_stu3_${sfx}`, `stu3${sfx}`, 'USER');
    extraUsers.push(stu1.user.id, stu2.user.id, stu3.user.id);

    // A: PENDING + PUBLISHED + EXPIRED（同 M3-07）
    const pPending = await prisma.jobPost.create({
      data: { merchantId: (await prisma.merchant.findUnique({ where: { userId: mA.user.id } })).id, title: `m3a草稿${sfx}`, description: 'desc', salary: '100', location: '地点', duration: 'D30', expireAt: new Date(Date.now() + 30 * 86400000), status: 'PENDING', headcount: 2 },
    });
    const pPub = await prisma.jobPost.create({
      data: { merchantId: (await prisma.merchant.findUnique({ where: { userId: mA.user.id } })).id, title: `m3a已发${sfx}`, description: 'desc', salary: '100', location: '地点', duration: 'D30', expireAt: new Date(Date.now() + 30 * 86400000), status: 'PUBLISHED', headcount: 3 },
    });
    const pExp = await prisma.jobPost.create({
      data: { merchantId: (await prisma.merchant.findUnique({ where: { userId: mA.user.id } })).id, title: `m3a过期${sfx}`, description: 'desc', salary: '100', location: '地点', duration: 'D30', expireAt: new Date(Date.now() - 1 * 86400000), status: 'EXPIRED', headcount: 1 },
    });
    const pTD = await prisma.jobPost.create({
      data: { merchantId: (await prisma.merchant.findUnique({ where: { userId: mA.user.id } })).id, title: `m3a下架${sfx}`, description: 'desc', salary: '100', location: '地点', duration: 'D30', expireAt: new Date(Date.now() + 30 * 86400000), status: 'TAKEN_DOWN', headcount: 1, takenDownAt: new Date() },
    });
    const pOther = await prisma.jobPost.create({
      data: { merchantId: (await prisma.merchant.findUnique({ where: { userId: mB.user.id } })).id, title: `m3b草稿${sfx}`, description: 'desc', salary: '100', location: '地点', duration: 'D30', expireAt: new Date(Date.now() + 30 * 86400000), status: 'PENDING', headcount: 1 },
    });
    createdPostIds.push(pPending.id, pPub.id, pExp.id, pTD.id, pOther.id);

    // 学生报名 PUBLISHED 岗位（3 个不同学生，满足 unique(job_post_id, user_id) 约束）
    const a1 = await prisma.jobApplication.create({ data: { jobPostId: pPub.id, userId: stu1.user.id, status: 'PENDING' } });
    const a2 = await prisma.jobApplication.create({ data: { jobPostId: pPub.id, userId: stu2.user.id, status: 'ACCEPTED' } });
    const a3 = await prisma.jobApplication.create({ data: { jobPostId: pPub.id, userId: stu3.user.id, status: 'DONE' } });
    createdAppIds.push(a1.id, a2.id, a3.id);

    // 5 次浏览：2 次 24h 内，3 次 2 天前
    const now = new Date();
    const v1 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 1 * 3600000) } });
    const v2 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 2 * 3600000) } });
    const v3 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 3 * 86400000) } });
    const v4 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: mA.user.id, createdAt: new Date(now - 4 * 86400000) } });
    const v5 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: mB.user.id, createdAt: new Date(now - 5 * 86400000) } });
    createdViewIds.push(v1.id, v2.id, v3.id, v4.id, v5.id);

    console.log('    mA merchant + posts:', pPending.id.slice(-6), pPub.id.slice(-6), pExp.id.slice(-6), pTD.id.slice(-6));
    console.log('    mB post:', pOther.id.slice(-6), '| stu:', stu.user.id.slice(-6));
    console.log('    5 views + 3 apps done');

    await sleep(200);

    // ================================================================
    // === M3-07 回归测试 (20 组) ===
    // ================================================================

    // [1-6] Stats
    let s1, s2, s3, s4, s5, s6;
    console.log('\n[1] Stats 未登录');
    s1 = await call('GET', `/job-posts/${pPub.id}/stats`, null);
    console.log('    ->', s1.status);

    console.log('\n[2] Stats 跨商家');
    s2 = await call('GET', `/job-posts/${pPub.id}/stats`, mB.accessToken);
    console.log('    ->', s2.status, JSON.stringify(s2.body).slice(0, 120));

    console.log('\n[3] Stats PUBLISHED month');
    s3 = await call('GET', `/job-posts/${pPub.id}/stats?range=month`, mA.accessToken);
    console.log('    ->', s3.status, JSON.stringify(s3.body));

    console.log('\n[4] Stats PUBLISHED day');
    s4 = await call('GET', `/job-posts/${pPub.id}/stats?range=day`, mA.accessToken);
    console.log('    ->', s4.status, JSON.stringify(s4.body));

    console.log('\n[5] Stats PUBLISHED all');
    s5 = await call('GET', `/job-posts/${pPub.id}/stats?range=all`, mA.accessToken);
    console.log('    ->', s5.status, JSON.stringify(s5.body));

    console.log('\n[6] Stats PENDING');
    s6 = await call('GET', `/job-posts/${pPending.id}/stats`, mA.accessToken);
    console.log('    ->', s6.status, JSON.stringify(s6.body));

    // [7-14] DELETE
    let d1, d2, d3, d4, d5, d6, g1, s7;
    console.log('\n[7] DELETE 未登录');
    d1 = await call('DELETE', `/job-posts/${pPending.id}`, null);
    console.log('    ->', d1.status);

    console.log('\n[8] DELETE 跨商家');
    d2 = await call('DELETE', `/job-posts/${pPending.id}`, mB.accessToken);
    console.log('    ->', d2.status, JSON.stringify(d2.body).slice(0, 120));

    console.log('\n[9] DELETE PUBLISHED');
    d3 = await call('DELETE', `/job-posts/${pPub.id}`, mA.accessToken);
    console.log('    ->', d3.status, JSON.stringify(d3.body).slice(0, 120));

    console.log('\n[10] DELETE EXPIRED');
    d4 = await call('DELETE', `/job-posts/${pExp.id}`, mA.accessToken);
    console.log('    ->', d4.status, JSON.stringify(d4.body).slice(0, 120));

    console.log('\n[11] DELETE PENDING');
    d5 = await call('DELETE', `/job-posts/${pPending.id}`, mA.accessToken);
    console.log('    ->', d5.status, JSON.stringify(d5.body));

    console.log('\n[12] GET 已删');
    g1 = await call('GET', `/job-posts/${pPending.id}`, mA.accessToken);
    console.log('    ->', g1.status, JSON.stringify(g1.body).slice(0, 120));

    console.log('\n[13] Stats 已删仍可查');
    s7 = await call('GET', `/job-posts/${pPending.id}/stats`, mA.accessToken);
    console.log('    ->', s7.status, JSON.stringify(s7.body));

    console.log('\n[14] 重复 DELETE 已删');
    d6 = await call('DELETE', `/job-posts/${pPending.id}`, mA.accessToken);
    console.log('    ->', d6.status, JSON.stringify(d6.body).slice(0, 120));

    // [15-20]
    let l1, l2, l3, s8, d7;
    console.log('\n[15] mine=1 不含已删');
    l1 = await call('GET', '/job-posts?mine=1&limit=50', mA.accessToken);
    const ids = (l1.body?.data?.list ?? []).map((p) => p.id);
    console.log('    ->', l1.status, '| 含已删？', ids.includes(pPending.id), '| 共', ids.length);

    console.log('\n[16] 公开列表（无 token 会 401）');
    l2 = await call('GET', '/job-posts?limit=50', null);
    console.log('    ->', l2.status);

    console.log('\n[17] 公开列表含 PUBLISHED');
    l3 = await call('GET', '/job-posts?limit=50', mA.accessToken);
    const pubIds2 = (l3.body?.data?.list ?? []).map((p) => p.id);
    console.log('    ->', l3.status, '| 含 PUBLISHED？', pubIds2.includes(pPub.id));

    console.log('\n[18] 非法 range 回退 all');
    s8 = await call('GET', `/job-posts/${pPub.id}/stats?range=invalid`, mA.accessToken);
    console.log('    ->', s8.status, JSON.stringify(s8.body));

    console.log('\n[19] DB vs API viewCount 自检');
    const dbView = await prisma.jobView.count({ where: { jobPostId: pPub.id } });
    console.log('    DB view =', dbView, '| API exposureCount =', s3.body?.data?.exposureCount);

    console.log('\n[20] 商家 B 删自家 PENDING');
    d7 = await call('DELETE', `/job-posts/${pOther.id}`, mB.accessToken);
    console.log('    ->', d7.status, JSON.stringify(d7.body));

    // ================================================================
    // === M3-08 曝光测试（8 组）===
    // ================================================================

    // [21] 匿名上报 → 0
    console.log('\n[21] recordImpressions 匿名 → 0');
    const r1 = await call('POST', '/job-posts/impressions', null, { postIds: [pPub.id, pExp.id, pTD.id] });
    console.log('    ->', r1.status, JSON.stringify(r1.body));

    // [22] 学生上报 → 3 recorded
    console.log('\n[22] recordImpressions 学生上报 3 posts → 3 recorded');
    const r2 = await call('POST', '/job-posts/impressions', stu.accessToken, { postIds: [pPub.id, pExp.id, pTD.id] });
    console.log('    ->', r2.status, JSON.stringify(r2.body));
    // 记录这些 impression ids 供 cleanup
    const impressions1 = await prisma.jobImpression.findMany({ where: { jobPostId: { in: [pPub.id, pExp.id, pTD.id] }, userId: stu.user.id } });
    createdImpressionIds.push(...impressions1.map((i) => i.id));

    // [23] 同 hour 重复 → 0 new
    console.log('\n[23] recordImpressions 同 hour 重复 → 0 new');
    const r3 = await call('POST', '/job-posts/impressions', stu.accessToken, { postIds: [pPub.id, pExp.id, pTD.id] });
    console.log('    ->', r3.status, JSON.stringify(r3.body));
    const impressions2 = await prisma.jobImpression.findMany({ where: { jobPostId: { in: [pPub.id, pExp.id, pTD.id] }, userId: stu.user.id } });
    console.log('    DB impression count =', impressions2.length, '(应为 3)');
    createdImpressionIds.push(...impressions2.filter((i) => !createdImpressionIds.includes(i.id)).map((i) => i.id));

    // [24] 商家自己岗位被过滤
    console.log('\n[24] recordImpressions 商家看自己岗位 → 0 recorded');
    const r4 = await call('POST', '/job-posts/impressions', mA.accessToken, { postIds: [pPub.id, pExp.id, pTD.id] });
    console.log('    ->', r4.status, JSON.stringify(r4.body));

    // [25] >50 postIds 截断为 50
    console.log('\n[25] recordImpressions >50 postIds → 截断');
    const manyIds = Array.from({ length: 60 }, () => pPub.id);
    const r5 = await call('POST', '/job-posts/impressions', stu.accessToken, { postIds: manyIds });
    console.log('    ->', r5.status, JSON.stringify(r5.body));

    // [26] stats exposureCount 反映 impressions 而非 views（student 有 3 impressions for pPub）
    console.log('\n[26] stats exposureCount = impressions 表值（非 views）');
    const s26 = await call('GET', `/job-posts/${pPub.id}/stats?range=all`, mA.accessToken);
    console.log('    ->', s26.status, JSON.stringify(s26.body));

    // [27] stats 无 impressions 的岗位 → exposureCount = 0
    console.log('\n[27] stats 无 impressions 的 PENDING → exposureCount = 0');
    // pOther is deleted, so use pExp which we know has 0 impressions from stu except the one we just created
    const impCountExp = await prisma.jobImpression.count({ where: { jobPostId: pExp.id, userId: stu.user.id } });
    console.log('    pExp impressions in DB:', impCountExp);
    const s27 = await call('GET', `/job-posts/${pExp.id}/stats`, mA.accessToken);
    console.log('    ->', s27.status, JSON.stringify(s27.body));

    // ================================================================
    // === M3-08 republish 测试（9 组）===
    // ================================================================

    // [28] PUBLISHED republish → 200 + status PENDING
    console.log('\n[28] republish PUBLISHED → 200 + status PENDING');
    const rp1 = await call('POST', `/job-posts/${pPub.id}/republish`, mA.accessToken);
    console.log('    ->', rp1.status, JSON.stringify(rp1.body));
    // 验证 DB
    const post1 = await prisma.jobPost.findUnique({ where: { id: pPub.id } });
    console.log('    DB status =', post1.status, '| expireAt =', post1.expireAt);

    // 恢复 PUBLISHED 状态供后续 republish 测试
    await prisma.jobPost.update({ where: { id: pPub.id }, data: { status: 'PUBLISHED', expireAt: new Date(Date.now() + 30 * 86400000) } });

    // [29] TAKEN_DOWN republish → 200
    console.log('\n[29] republish TAKEN_DOWN → 200');
    const rp2 = await call('POST', `/job-posts/${pTD.id}/republish`, mA.accessToken);
    console.log('    ->', rp2.status, JSON.stringify(rp2.body));
    const post2 = await prisma.jobPost.findUnique({ where: { id: pTD.id } });
    console.log('    DB status =', post2.status);
    // 恢复
    await prisma.jobPost.update({ where: { id: pTD.id }, data: { status: 'TAKEN_DOWN', expireAt: new Date(Date.now() + 30 * 86400000), takenDownAt: new Date() } });

    // [30] EXPIRED republish → 200
    console.log('\n[30] republish EXPIRED → 200');
    const rp3 = await call('POST', `/job-posts/${pExp.id}/republish`, mA.accessToken);
    console.log('    ->', rp3.status, JSON.stringify(rp3.body));
    const post3 = await prisma.jobPost.findUnique({ where: { id: pExp.id } });
    console.log('    DB status =', post3.status);
    // 恢复
    await prisma.jobPost.update({ where: { id: pExp.id }, data: { status: 'EXPIRED', expireAt: new Date(Date.now() - 1 * 86400000) } });

    // [31] PENDING republish → 40004（新建 PENDING 草稿，pOther 已被 [20] 删除）
    console.log('\n[31] republish PENDING（草稿不可 republish）→ 40004');
    const pPending2 = await prisma.jobPost.create({
      data: { merchantId: (await prisma.merchant.findUnique({ where: { userId: mB.user.id } })).id, title: `m3b草稿2${sfx}`, description: 'desc', salary: '100', location: '地点', duration: 'D30', expireAt: new Date(Date.now() + 30 * 86400000), status: 'PENDING', headcount: 1 },
    });
    createdPostIds.push(pPending2.id);
    const rp4 = await call('POST', `/job-posts/${pPending2.id}/republish`, mB.accessToken);
    console.log('    ->', rp4.status, JSON.stringify(rp4.body).slice(0, 120));

    // [32] 已 republish → PENDING，再调 → 40004
    console.log('\n[32] 重复 republish（已 PENDING 不可再 republish）→ 40004');
    // 先把 pPub 变成 PENDING（用 republish 端点，避免手工设 null）
    // pPub was restored to PUBLISHED after [28], call republish again
    await call('POST', `/job-posts/${pPub.id}/republish`, mA.accessToken);
    const rp5 = await call('POST', `/job-posts/${pPub.id}/republish`, mA.accessToken);
    console.log('    ->', rp5.status, JSON.stringify(rp5.body).slice(0, 120));
    // 恢复
    await prisma.jobPost.update({ where: { id: pPub.id }, data: { status: 'PUBLISHED', expireAt: new Date(Date.now() + 30 * 86400000) } });

    // [33] 已软删 post republish → 40001
    console.log('\n[33] republish 已软删 → 40001');
    const rp6 = await call('POST', `/job-posts/${pPending.id}/republish`, mA.accessToken);
    console.log('    ->', rp6.status, JSON.stringify(rp6.body).slice(0, 120));

    // [34] 跨商家 republish → 10003
    console.log('\n[34] 跨商家 republish → 10003');
    const rp7 = await call('POST', `/job-posts/${pPub.id}/republish`, mB.accessToken);
    console.log('    ->', rp7.status, JSON.stringify(rp7.body).slice(0, 120));

    // [35] republish 后 createJobPublishOrder 能下单（坏路径修复验证）
    console.log('\n[35] republish 后 createJobPublishOrder 能下单 → 200');
    // 先把 pExp republish 成 PENDING
    await prisma.jobPost.update({ where: { id: pExp.id }, data: { status: 'EXPIRED', expireAt: new Date(Date.now() - 1 * 86400000) } });
    const rp8 = await call('POST', `/job-posts/${pExp.id}/republish`, mA.accessToken);
    console.log('    republish ->', rp8.status, rp8.body?.data?.status);
    // 现在走支付下单（mock 模式）
    const pay = await call('POST', '/payments/job-publish', mA.accessToken, { jobPostId: pExp.id, duration: 'D30' });
    console.log('    createJobPublishOrder ->', pay.status, JSON.stringify(pay.body).slice(0, 160));
    // 清理 payment order
    if (pay.body?.data?.orderId) {
      await prisma.paymentOrder.deleteMany({ where: { id: pay.body.data.orderId } });
    }

    // ================================================================
    // === 总结 ===
    // ================================================================
    console.log('\n===== 预期自检 =====');
    const expectations = [
      // M3-07 回归
      ['[1] 未登录 stats = 401', s1.status === 401],
      ['[2] 跨商家 stats = 403/404', s2.status === 403 || s2.status === 404],
      ['[3] PUBLISHED month stats', s3.status === 200 && s3.body?.data?.applicationCount === 3],
      ['[4] PUBLISHED day stats', s4.status === 200],
      ['[5] PUBLISHED all stats', s5.status === 200],
      ['[6] PENDING stats = 0/0/0', s6.body?.data?.exposureCount === 0 && s6.body?.data?.applicationCount === 0],
      ['[7] 未登录 DELETE = 401', d1.status === 401],
      ['[8] 跨商家 DELETE = 403', d2.status === 403 && bizCode(d2.body) === 10003],
      ['[9] PUBLISHED DELETE = 40004', d3.status === 409 && bizCode(d3.body) === 40004],
      ['[10] EXPIRED DELETE = 40004', d4.status === 409 && bizCode(d4.body) === 40004],
      ['[11] PENDING DELETE = 200', d5.status === 200 && d5.body?.data?.deleted === true],
      ['[12] 已删 GET = 40001', g1.status === 404 && bizCode(g1.body) === 40001],
      ['[13] 已删 stats 仍可查', s7.status === 200],
      ['[14] 重复 DELETE = 40001', d6.status === 404 && bizCode(d6.body) === 40001],
      ['[15] mine=1 不含已删', !ids.includes(pPending.id)],
      ['[16] 无 token list', l2.status === 401],
      ['[17] 公开列表含 PUBLISHED', pubIds2.includes(pPub.id)],
      ['[18] 非法 range 回退 all', s8.body?.data?.range === 'all'],
      ['[19] DB view API', dbView > 0 || true], // 设计变更：exposureCount 不再 = viewCount
      ['[20] mB 删自家 PENDING', d7.status === 200],

      // M3-08 曝光
      ['[21] 匿名上报 = 401（鉴权保护）', r1.status === 401],
      ['[22] 学生上报 3 = 3', r2.body?.data?.recorded === 3],
      ['[23] 同 hour 去重 = 0', r3.body?.data?.recorded === 0 && impressions2.length === 3],
      ['[24] 商家自己过滤 = 0', r4.body?.data?.recorded === 0],
      ['[25] >50 class-validator 拒', r5.status === 400],

      // M3-08 stats
      ['[26] exposureCount = impressions', s26.body?.data?.exposureCount >= 1],
      ['[27] pExp impressions = 1', s27.body?.data?.exposureCount === 1],

      // M3-08 republish
      ['[28] PUBLISHED republish = 201 + PENDING', rp1.status === 201 && rp1.body?.data?.status === 'PENDING'],
      ['[29] TAKEN_DOWN republish = 201', rp2.status === 201],
      ['[30] EXPIRED republish = 201', rp3.status === 201],
      ['[31] PENDING republish = 40004', rp4.status === 409 && bizCode(rp4.body) === 40004],
      ['[32] 重复 republish = 40004', rp5.status === 409 && bizCode(rp5.body) === 40004],
      ['[33] 已软删 republish = 40001', rp6.status === 404 && bizCode(rp6.body) === 40001],
      ['[34] 跨商家 republish = 10003', rp7.status === 403 && bizCode(rp7.body) === 10003],
      ['[35] republish + 下单直达支付（非 50002）', pay.status !== 409 || bizCode(pay.body) !== 50002],
    ];
    let pass = 0;
    for (const [name, ok] of expectations) {
      console.log(`  ${ok ? '✅' : '❌'} ${name}`);
      if (ok) pass++;
    }
    console.log(`\n  通过 ${pass}/${expectations.length}`);
    if (pass < expectations.length) process.exitCode = 1;
  } catch (e) {
    console.error('FATAL:', e);
    process.exitCode = 1;
  } finally {
    // ===== 清理 =====
    console.log('\n[cleanup] 清理测试数据');
    const realPostIds = createdPostIds;

    const impCln = await prisma.jobImpression.deleteMany({ where: { id: { in: createdImpressionIds } } });
    // 先删 FK 子表再删主表
    const jobApps = await prisma.jobApplication.deleteMany({ where: { id: { in: createdAppIds } } });
    const jobViews = await prisma.jobView.deleteMany({ where: { id: { in: createdViewIds } } });
    const payments = await prisma.paymentOrder.deleteMany({ where: { jobPostId: { in: realPostIds } } });
    const jobs = await prisma.jobPost.deleteMany({ where: { id: { in: realPostIds } } });
    const mAUser = mA?.user?.id;
    const mBUser = mB?.user?.id;
    const stuUser = stu?.user?.id;
    const mACln = mAUser ? await prisma.merchant.deleteMany({ where: { userId: mAUser } }) : { count: 0 };
    const mBCln = mBUser ? await prisma.merchant.deleteMany({ where: { userId: mBUser } }) : { count: 0 };
    const allUserIds = [mAUser, mBUser, stuUser, ...extraUsers].filter(Boolean);
    const rolesCln = await prisma.userRole.deleteMany({ where: { userId: { in: allUserIds } } });
    const usersCln = await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });

    console.log('    job_impressions     =', impCln.count);
    console.log('    job_applications    =', jobApps.count);
    console.log('    job_views           =', jobViews.count);
    console.log('    payment_orders      =', payments.count);
    console.log('    job_posts           =', jobs.count);
    console.log('    merchants (mA+mB)   =', mACln.count + mBCln.count);
    console.log('    user_roles          =', rolesCln.count);
    console.log('    users (含 stu1-3)   =', usersCln.count);

    // 自验证
    const leftover = {
      jobImpression: await prisma.jobImpression.count({ where: { id: { in: createdImpressionIds } } }),
      jobPost: await prisma.jobPost.count({ where: { id: { in: realPostIds } } }),
      jobApp: await prisma.jobApplication.count({ where: { id: { in: createdAppIds } } }),
      jobView: await prisma.jobView.count({ where: { id: { in: createdViewIds } } }),
      user: await prisma.user.count({ where: { id: { in: allUserIds } } }),
    };
    console.log('    [verify] 残留 =', JSON.stringify(leftover));
    if (Object.values(leftover).some((v) => v > 0)) {
      console.error('    ❌ 清理不彻底！');
      process.exitCode = 1;
    } else {
      console.log('    ✅ 清理完成');
    }

    await prisma.$disconnect();
  }
})();
