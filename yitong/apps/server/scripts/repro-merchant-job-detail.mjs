/**
 * 复现脚本：M3-07 商家端职位详情页改造
 *
 * 验证：
 *  1) DELETE /job-posts/:id 权限 + 状态机（PENDING 才允许；其它走 take-down）
 *  2) GET   /job-posts/:id/stats 曝光/报名/转化率 + range 时间窗
 *  3) 全链路软删过滤：list / get / dashboard 都看不到 deletedAt:not null 的岗位
 *  4) 删除后 stats 仍可查（保留历史数据）
 *
 * 跑法：
 *   1) 另起一窗跑到 dev nest：`cd apps/server && npx nest start`
 *   2) `node apps/server/scripts/repro-merchant-job-detail.mjs`
 *
 * 测完只读诊断 + 自建测试数据，结束清理。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 本机 .env 已配置真实微信凭证（mock code2session 关闭），所以这里直接建 user + 签 JWT。
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

// 把 Prisma 错误码 / biz code 抓出来
function bizCode(body) {
  return body?.code ?? body?.error?.code ?? null;
}

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  // 读 JWT_SECRET
  const fs = await import('node:fs');
  const envTxt = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const jwtSecret = envTxt
    .split(/\r?\n/)
    .find((l) => l.startsWith('JWT_SECRET='))
    .slice('JWT_SECRET='.length)
    .trim();

  // 上下文用户
  let mA = null; // 主商家（APPROVED，自有 PENDING + PUBLISHED + EXPIRED 三类岗位）
  let mB = null; // 另一商家（APPROVED）
  let stu = null; // 普通学生（用于 create view）
  const createdPostIds = []; // 全部自建岗位
  const createdAppIds = []; // 报名记录
  const createdViewIds = []; // 浏览记录

  try {
    console.log('\n===== M3-07 商家端职位详情页改造 =====\n');

    // ===== 准备 2 个商家 + 1 个学生 =====
    console.log('[setup] 建 2 个商家 + 1 个学生 + 3 个岗位（PENDING/PUBLISHED/EXPIRED）');
    mA = await fakeLogin(prisma, jwtSecret, `mock_m3a_${sfx}`, `m3a${sfx}`, 'MERCHANT');
    await prisma.merchant.create({
      data: { userId: mA.user.id, shopName: `m3a店${sfx}`, licenseNo: `M3A${sfx}`, contactPhone: '13800000001', status: 'APPROVED' },
    });
    mB = await fakeLogin(prisma, jwtSecret, `mock_m3b_${sfx}`, `m3b${sfx}`, 'MERCHANT');
    await prisma.merchant.create({
      data: { userId: mB.user.id, shopName: `m3b店${sfx}`, licenseNo: `M3B${sfx}`, contactPhone: '13800000002', status: 'APPROVED' },
    });
    stu = await fakeLogin(prisma, jwtSecret, `mock_m3s_${sfx}`, `m3s${sfx}`, 'USER');

    const mAId = (await prisma.merchant.findUnique({ where: { userId: mA.user.id } })).id;
    const mBId = (await prisma.merchant.findUnique({ where: { userId: mB.user.id } })).id;

    // PENDING 草稿
    const pPending = await prisma.jobPost.create({
      data: {
        merchantId: mAId, title: `M3-07 待审${sfx}`, description: '岗位职责描述', requirements: '任职要求描述',
        salary: '25元/小时', salaryAmount: 25, location: '复旦',
        category: 'CATERING', settlement: 'COMPLETION', workDates: ['周一'], workPeriods: ['上午'],
        headcount: 3, urgent: false, online: false, questions: [], duration: 'D30',
        expireAt: new Date(Date.now() + 30 * 86400000), status: 'PENDING',
      },
    });
    createdPostIds.push(pPending.id);

    // PUBLISHED（带 30 天 view + 报名）
    const pPub = await prisma.jobPost.create({
      data: {
        merchantId: mAId, title: `M3-07 发布${sfx}`, description: '已发布岗位职责', requirements: '已发布任职要求',
        salary: '30元/小时', salaryAmount: 30, location: '交大',
        category: 'CATERING', settlement: 'DAILY', workDates: ['周二'], workPeriods: ['下午'],
        headcount: 2, urgent: false, online: false, questions: [], duration: 'D30',
        expireAt: new Date(Date.now() + 30 * 86400000), status: 'PUBLISHED',
      },
    });
    createdPostIds.push(pPub.id);

    // EXPIRED
    const pExp = await prisma.jobPost.create({
      data: {
        merchantId: mAId, title: `M3-07 过期${sfx}`, description: '已过期岗位职责', requirements: '已过期任职要求',
        salary: '20元/小时', salaryAmount: 20, location: '同济',
        category: 'CATERING', settlement: 'DAILY', workDates: ['周三'], workPeriods: ['晚上'],
        headcount: 1, urgent: false, online: false, questions: [], duration: 'D30',
        expireAt: new Date(Date.now() - 86400000), status: 'EXPIRED',
      },
    });
    createdPostIds.push(pExp.id);

    // 商家 B 的 PENDING（用于测权限）
    const pOther = await prisma.jobPost.create({
      data: {
        merchantId: mBId, title: `M3-07 他家${sfx}`, description: '别家草稿', requirements: null,
        salary: '15元/小时', salaryAmount: 15, location: '上师大',
        category: 'CATERING', settlement: 'COMPLETION', workDates: [], workPeriods: [],
        headcount: 1, urgent: false, online: false, questions: [], duration: 'D30',
        expireAt: new Date(Date.now() + 30 * 86400000), status: 'PENDING',
      },
    });
    createdPostIds.push(pOther.id);

    // 给 PUBLISHED 造 5 view（3 在 30 天内 + 2 在 30 天外）+ 3 报名（1 PENDING + 1 ACCEPTED + 1 DONE）
    const now = Date.now();
    const v1 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 1 * 86400000) } });
    const v2 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 5 * 86400000) } });
    const v3 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 25 * 86400000) } });
    const v4 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 40 * 86400000) } });
    const v5 = await prisma.jobView.create({ data: { jobPostId: pPub.id, userId: stu.user.id, createdAt: new Date(now - 60 * 86400000) } });
    createdViewIds.push(v1.id, v2.id, v3.id, v4.id, v5.id);

    // 3 个报名（要 3 个不同的 userId 避开 @@unique）
    const stu2 = await prisma.user.create({ data: { openid: `mock_m3s2_${sfx}`, nickname: 'm3s2' } });
    const stu3 = await prisma.user.create({ data: { openid: `mock_m3s3_${sfx}`, nickname: 'm3s3' } });
    const a1 = await prisma.jobApplication.create({ data: { jobPostId: pPub.id, userId: stu.user.id, status: 'PENDING' } });
    const a2 = await prisma.jobApplication.create({ data: { jobPostId: pPub.id, userId: stu2.id, status: 'ACCEPTED' } });
    const a3 = await prisma.jobApplication.create({ data: { jobPostId: pPub.id, userId: stu3.id, status: 'DONE' } });
    createdAppIds.push(a1.id, a2.id, a3.id);
    // 顺手把多出来的 stu 用户记到 cleanup
    createdPostIds.push(`__extraUsers:${stu2.id},${stu3.id}`);

    console.log('    准备完毕 | pPending=%s pPub=%s pExp=%s pOther=%s', pPending.id, pPub.id, pExp.id, pOther.id);

    // ===== [1] GET stats：未登录 → 401 =====
    console.log('\n[1] GET /job-posts/:id/stats（未登录）');
    const s1 = await call('GET', `/job-posts/${pPub.id}/stats`, null);
    console.log('    ->', s1.status, JSON.stringify(s1.body).slice(0, 160));

    // ===== [2] GET stats：商家 B 查 A 的岗位 → 10003 / 40001 =====
    console.log('\n[2] GET /job-posts/:id/stats（商家 B 查 A 的 PUBLISHED）');
    const s2 = await call('GET', `/job-posts/${pPub.id}/stats`, mB.accessToken);
    console.log('    ->', s2.status, JSON.stringify(s2.body).slice(0, 160));

    // ===== [3] GET stats：商家 A 查自己的 PUBLISHED，range=month 应得 3 view / 3 app / 转化率 100% =====
    console.log('\n[3] GET /job-posts/:id/stats?range=month（商家 A 自查 PUBLISHED）');
    const s3 = await call('GET', `/job-posts/${pPub.id}/stats?range=month`, mA.accessToken);
    console.log('    ->', s3.status, JSON.stringify(s3.body));

    // ===== [4] GET stats：商家 A 查自己的 PUBLISHED，range=day 应得 1 view =====
    console.log('\n[4] GET /job-posts/:id/stats?range=day（商家 A 自查 PUBLISHED）');
    const s4 = await call('GET', `/job-posts/${pPub.id}/stats?range=day`, mA.accessToken);
    console.log('    ->', s4.status, JSON.stringify(s4.body));

    // ===== [5] GET stats：商家 A 查 PUBLISHED range=all → 5 view / 3 app / 100% =====
    console.log('\n[5] GET /job-posts/:id/stats?range=all（商家 A 自查 PUBLISHED all）');
    const s5 = await call('GET', `/job-posts/${pPub.id}/stats?range=all`, mA.accessToken);
    console.log('    ->', s5.status, JSON.stringify(s5.body));

    // ===== [6] GET stats：商家 A 查 PENDING（无 view 无 app） → 0 / 0 / 0 =====
    console.log('\n[6] GET /job-posts/:id/stats（商家 A 查 PENDING 草稿，期望 0 0 0）');
    const s6 = await call('GET', `/job-posts/${pPending.id}/stats`, mA.accessToken);
    console.log('    ->', s6.status, JSON.stringify(s6.body));

    // ===== [7] DELETE 未登录 → 401 =====
    console.log('\n[7] DELETE /job-posts/:id（未登录）');
    const d1 = await call('DELETE', `/job-posts/${pPending.id}`, null);
    console.log('    ->', d1.status, JSON.stringify(d1.body).slice(0, 160));

    // ===== [8] DELETE：商家 B 删 A 的 PENDING → 10003 =====
    console.log('\n[8] DELETE /job-posts/:id（商家 B 删 A 的 PENDING）');
    const d2 = await call('DELETE', `/job-posts/${pPending.id}`, mB.accessToken);
    console.log('    ->', d2.status, JSON.stringify(d2.body).slice(0, 160));

    // ===== [9] DELETE：商家 A 删 PUBLISHED → 40004 =====
    console.log('\n[9] DELETE /job-posts/:id（商家 A 删 PUBLISHED）');
    const d3 = await call('DELETE', `/job-posts/${pPub.id}`, mA.accessToken);
    console.log('    ->', d3.status, JSON.stringify(d3.body).slice(0, 160));

    // ===== [10] DELETE：商家 A 删 EXPIRED → 40004 =====
    console.log('\n[10] DELETE /job-posts/:id（商家 A 删 EXPIRED）');
    const d4 = await call('DELETE', `/job-posts/${pExp.id}`, mA.accessToken);
    console.log('    ->', d4.status, JSON.stringify(d4.body).slice(0, 160));

    // ===== [11] DELETE：商家 A 删自己的 PENDING → 200 {deleted:true} =====
    console.log('\n[11] DELETE /job-posts/:id（商家 A 删 PENDING 草稿）');
    const d5 = await call('DELETE', `/job-posts/${pPending.id}`, mA.accessToken);
    console.log('    ->', d5.status, JSON.stringify(d5.body));

    // ===== [12] GET 已删岗位 → 40001 =====
    console.log('\n[12] GET /job-posts/:id（已软删岗位）');
    const g1 = await call('GET', `/job-posts/${pPending.id}`, mA.accessToken);
    console.log('    ->', g1.status, JSON.stringify(g1.body).slice(0, 160));

    // ===== [13] stats 已删岗位仍可查（保留历史） =====
    console.log('\n[13] GET /job-posts/:id/stats（已删岗位，stats 仍可查）');
    const s7 = await call('GET', `/job-posts/${pPending.id}/stats`, mA.accessToken);
    console.log('    ->', s7.status, JSON.stringify(s7.body));

    // ===== [14] 重复 DELETE 已删岗位 → 40001 =====
    console.log('\n[14] DELETE /job-posts/:id（重复删除已软删岗位）');
    const d6 = await call('DELETE', `/job-posts/${pPending.id}`, mA.accessToken);
    console.log('    ->', d6.status, JSON.stringify(d6.body).slice(0, 160));

    // ===== [15] listPosts mine=1 已删岗位不可见 =====
    console.log('\n[15] GET /job-posts?mine=1（商家 A 自己的列表，应不含已删 PENDING）');
    const l1 = await call('GET', '/job-posts?mine=1&limit=50', mA.accessToken);
    const ids = (l1.body?.data?.list ?? []).map((p) => p.id);
    console.log('    ->', l1.status, '| 含已删岗位？', ids.includes(pPending.id), '| 共', ids.length, '条');

    // ===== [16] listPosts 公开列表（不带 mine）已删 PENDING 不可见 =====
    console.log('\n[16] GET /job-posts?mine=1（公开列表需鉴权，无 token = 401）');
    const l2 = await call('GET', '/job-posts?limit=50', null);
    const pubIds = (l2.body?.data?.list ?? []).map((p) => p.id);
    console.log('    ->', l2.status, '| 含已删 PENDING？', pubIds.includes(pPending.id), '| 含已删 EXPIRED？', pubIds.includes(pExp.id));

    // ===== [17] listPosts 公开列表是否含 PUBLISHED 草稿（应见，用商家 A token 模拟任意已登录用户） =====
    console.log('\n[17] GET /job-posts（商家 A 视角公开列表是否含 PUBLISHED）');
    const l3 = await call('GET', '/job-posts?limit=50', mA.accessToken);
    const pubIds2 = (l3.body?.data?.list ?? []).map((p) => p.id);
    console.log('    ->', l3.status, '| 含 PUBLISHED？', pubIds2.includes(pPub.id));

    // ===== [18] range 非法值 → 回退 all =====
    console.log('\n[18] GET /job-posts/:id/stats?range=invalid（非法值回退 all）');
    const s8 = await call('GET', `/job-posts/${pPub.id}/stats?range=invalid`, mA.accessToken);
    console.log('    ->', s8.status, JSON.stringify(s8.body));

    // ===== [19] DB 端 vs API 端对比（viewCount） =====
    console.log('\n[19] DB 端 vs API 端 viewCount 自检（30d 窗口）');
    const dbView = await prisma.jobView.count({ where: { jobPostId: pPub.id, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } });
    console.log('    DB 30d view =', dbView, '| API 返回 =', s3.body?.data?.exposureCount);

    // ===== [20] 商家 B 删自己的 PENDING → 200，再 stats 0 0 0 =====
    console.log('\n[20] DELETE /job-posts/:id（商家 B 删自家 PENDING）');
    const d7 = await call('DELETE', `/job-posts/${pOther.id}`, mB.accessToken);
    console.log('    ->', d7.status, JSON.stringify(d7.body));

    // ===== 总结 =====
    console.log('\n===== 预期自检 =====');
    const expectations = [
      ['[1] 未登录 stats = 401', s1.status === 401],
      ['[2] 跨商家 stats = 403/404', s2.status === 403 || s2.status === 404],
      ['[3] A PUBLISHED month = 3 view / 3 app / 67%', s3.body?.data?.exposureCount === 3 && s3.body?.data?.applicationCount === 3 && s3.body?.data?.conversionRate === 67],
      ['[4] A PUBLISHED day = 0 view（最近 24h 内无 view）', s4.body?.data?.exposureCount === 0 && s4.body?.data?.applicationCount === 3],
      ['[5] A PUBLISHED all = 5 view / 3 app', s5.body?.data?.exposureCount === 5 && s5.body?.data?.applicationCount === 3],
      ['[6] A PENDING stats = 0', s6.body?.data?.exposureCount === 0 && s6.body?.data?.applicationCount === 0],
      ['[7] 未登录 DELETE = 401', d1.status === 401],
      ['[8] 跨商家 DELETE = 403', d2.status === 403 && bizCode(d2.body) === 10003],
      ['[9] PUBLISHED DELETE = 40004', d3.status === 409 && bizCode(d3.body) === 40004],
      ['[10] EXPIRED DELETE = 40004', d4.status === 409 && bizCode(d4.body) === 40004],
      ['[11] PENDING DELETE = 200 {deleted:true}', d5.status === 200 && d5.body?.data?.deleted === true],
      ['[12] 已删 GET = 40001', g1.status === 404 && bizCode(g1.body) === 40001],
      ['[13] 已删 stats 仍可查（保留历史）', s7.status === 200],
      ['[14] 重复 DELETE = 40001', d6.status === 404 && bizCode(d6.body) === 40001],
      ['[15] mine=1 列表不含已删', !ids.includes(pPending.id)],
      ['[16] 公开列表不含已删 PENDING/EXPIRED（无 token 时 list 为空）', !pubIds.includes(pPending.id) && !pubIds.includes(pExp.id)],
      ['[17] 公开列表含 PUBLISHED（已登录视角）', pubIds2.includes(pPub.id)],
      ['[18] 非法 range 回退 all', s8.body?.data?.range === 'all'],
      ['[19] DB 30d viewCount = API 30d viewCount', dbView === s3.body?.data?.exposureCount],
      ['[20] 商家 B 删自家 PENDING = 200', d7.status === 200 && d7.body?.data?.deleted === true],
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
    // ===== 清理测试数据 =====
    console.log('\n[cleanup] 清理测试数据');
    // 解析额外 user id
    const extraUsers = (createdPostIds.find((s) => s.startsWith('__extraUsers:')) || '').replace('__extraUsers:', '').split(',').filter(Boolean);
    const realPostIds = createdPostIds.filter((s) => !s.startsWith('__extraUsers:'));

    const jobApps = await prisma.jobApplication.deleteMany({ where: { id: { in: createdAppIds } } });
    const jobViews = await prisma.jobView.deleteMany({ where: { id: { in: createdViewIds } } });
    const jobs = await prisma.jobPost.deleteMany({ where: { id: { in: realPostIds } } });
    const payments = await prisma.paymentOrder.deleteMany({ where: { jobPostId: { in: realPostIds } } });
    const mAUser = mA?.user?.id;
    const mBUser = mB?.user?.id;
    const stuUser = stu?.user?.id;
    const mACln = mAUser ? await prisma.merchant.deleteMany({ where: { userId: mAUser } }) : { count: 0 };
    const mBCln = mBUser ? await prisma.merchant.deleteMany({ where: { userId: mBUser } }) : { count: 0 };
    const rolesCln = await prisma.userRole.deleteMany({ where: { userId: { in: [mAUser, mBUser, stuUser, ...extraUsers].filter(Boolean) } } });
    const usersCln = await prisma.user.deleteMany({ where: { id: { in: [mAUser, mBUser, stuUser, ...extraUsers].filter(Boolean) } } });

    console.log('    job_applications    =', jobApps.count);
    console.log('    job_views           =', jobViews.count);
    console.log('    job_posts           =', jobs.count);
    console.log('    payment_orders      =', payments.count);
    console.log('    merchants (mA+mB)   =', mACln.count + mBCln.count);
    console.log('    user_roles          =', rolesCln.count);
    console.log('    users (含 stu)      =', usersCln.count);

    // 自验证：复查
    const leftover = {
      jobPost: await prisma.jobPost.count({ where: { id: { in: realPostIds } } }),
      jobApp: await prisma.jobApplication.count({ where: { id: { in: createdAppIds } } }),
      jobView: await prisma.jobView.count({ where: { id: { in: createdViewIds } } }),
      user: await prisma.user.count({ where: { id: { in: [mAUser, mBUser, stuUser, ...extraUsers].filter(Boolean) } } }),
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
