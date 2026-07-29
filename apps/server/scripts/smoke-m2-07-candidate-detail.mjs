/**
 * M2-07 候选人详情接口 smoke
 * 覆盖：GET /api/v1/merchant/candidates/:id 完整字段 + 状态机 + 隔离场景 + 简历空 + answers 空
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

// 收集本次测试创建的所有可清理的 ID（按 FK 顺序由后续清理脚本使用）
const created = {
  userIds: [],
  merchantIds: [],
  jobPostIds: [],
  jobApplicationIds: [],
  jobViewIds: [],
  paymentOrderIds: [],
  notificationIds: [],
  resumeIds: [],
};

(async () => {
  console.log('[m2-07 candidate-detail smoke] base =', BASE);
  const sfx = `m2cand${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  // 1) 登录 4 个用户：A 商家（发岗）、B 学生（完整简历）、B2 学生（无简历）、C 商家（隔离用）
  const A = await login(`MA${sfx}`, `Merchant_${sfx}`, 'merchant');
  created.userIds.push(A.user.id);
  await sleep(14000); // 限流 5/min
  const B = await login(`MB${sfx}`, `Stu_B_${sfx}`, 'user');
  created.userIds.push(B.user.id);
  const B2 = await login(`MB2${sfx}`, `Stu_B2_${sfx}`, 'user');
  created.userIds.push(B2.user.id);
  const C = await login(`MC${sfx}`, `Merchant_C_${sfx}`, 'merchant');
  created.userIds.push(C.user.id);

  // 2) A/C 入驻；B2 不入驻
  const regA = await call('POST', '/merchant/register', A.accessToken, {
    shopName: `店铺A_${sfx}`, licenseNo: `LICA${sfx}`, contactPhone: '13800000001',
  });
  assert(regA.body.code === 0, 'A 入驻成功');
  const mA = await call('GET', '/merchant/profile', A.accessToken);
  created.merchantIds.push(mA.body.data.id);
  const regC = await call('POST', '/merchant/register', C.accessToken, {
    shopName: `店铺C_${sfx}`, licenseNo: `LICC${sfx}`, contactPhone: '13800000003',
  });
  assert(regC.body.code === 0, 'C 入驻成功');
  const mC = await call('GET', '/merchant/profile', C.accessToken);
  created.merchantIds.push(mC.body.data.id);

  // 3) A 发岗（含 questions）
  const post = await call('POST', '/job-posts', A.accessToken, {
    title: `M2-07岗位_${sfx}`,
    description: 'm2-07 测试岗位描述',
    salary: '100/天',
    location: '校',
    category: 'CATERING',
    settlement: 'DAILY',
    workDates: ['周六'],
    workPeriods: ['全天'],
    headcount: 1,
    questions: ['你的身份', '可到岗时间'],
    duration: 'D30',
  });
  assert(post.body.code === 0, `A 发岗成功 ${JSON.stringify(post.body).slice(0, 120)}`);
  const pid = post.body.data.id;
  created.jobPostIds.push(pid);

  // 4) 付费发布（dev mock 直接置 PUBLISHED）
  const pay = await call('POST', '/payments/job-publish', A.accessToken, { jobPostId: pid, duration: 'D30' });
  assert(pay.body.code === 0, 'A 付费发布（mock）');
  // 订单已在 created 之外的 mock 路径中创建，需从 DB 取
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const orders = await prisma.paymentOrder.findMany({ where: { jobPostId: pid }, select: { id: true } });
  created.paymentOrderIds.push(...orders.map((o) => o.id));

  // 5) B 建完整简历（6 字段，completeness 应为 100）
  const resume = await call('PUT', '/resume', B.accessToken, {
    name: '测试学生B',
    phone: '13900000001',
    selfIntro: '我是B，正在做m2-07测试',
    skills: ['服务', '沟通'],
    availabilities: ['周六全天'],
    experience: '做过类似兼职',
  });
  assert(resume.body.code === 0, 'B 建简历成功');
  const resumeId = resume.body.data.id;
  created.resumeIds.push(resumeId);

  // 6) B 报名（带 answers）
  const app = await call('POST', `/job-posts/${pid}/applications`, B.accessToken, {
    resumeId,
    answers: ['我在校大学生', '周六全天'],
  });
  assert(app.body.code === 0, `B 报名成功 ${JSON.stringify(app.body).slice(0, 120)}`);
  const appId = app.body.data.id;
  created.jobApplicationIds.push(appId);

  // B 浏览岗位（会触发 JobView）
  await call('GET', `/job-posts/${pid}`, B.accessToken);
  await sleep(800);
  const viewsNow = await prisma.jobView.findMany({ where: { jobPostId: pid, userId: B.user.id }, select: { id: true } });
  created.jobViewIds.push(...viewsNow.map((v) => v.id));

  // 7) A 录用 B -> notification JOB_ACCEPT
  const accept = await call('POST', `/applications/${appId}/transition`, A.accessToken, { action: 'accept' });
  assert(accept.body.code === 0, 'A 录用 B');

  // 8) A 完成 -> notification JOB_COMPLETE
  const complete = await call('POST', `/applications/${appId}/transition`, A.accessToken, { action: 'complete' });
  assert(complete.body.code === 0, 'A 完成 B');

  // 9) 用 A token 调 GET /merchant/candidates/:id
  const detail = await call('GET', `/merchant/candidates/${appId}`, A.accessToken);
  assert(detail.body.code === 0, '候选人详情接口 code=0');
  const d = detail.body.data;

  // a) 字段齐全
  for (const k of ['id', 'status', 'createdAt', 'contactedAt', 'fitMark', 'user', 'jobPost', 'resume', 'answers', 'history']) {
    assert(k in d, `top-level 字段齐: ${k}`);
  }
  assert(d.id === appId, 'id 匹配');
  assert(d.user && typeof d.user === 'object', 'user 是对象');
  for (const k of ['id', 'nickname', 'avatarUrl']) {
    assert(k in d.user, `user 字段齐: ${k}`);
  }
  for (const k of ['id', 'title', 'description', 'requirements', 'salary', 'location', 'category', 'settlement', 'workDates', 'workPeriods', 'headcount', 'urgent', 'online', 'questions', 'expireAt', 'status']) {
    assert(k in d.jobPost, `jobPost 字段齐: ${k}`);
  }
  assert(d.jobPost.title === `M2-07岗位_${sfx}`, `jobPost.title 匹配 got=${d.jobPost.title}`);
  assert(Array.isArray(d.jobPost.questions) && d.jobPost.questions.length === 2, 'jobPost.questions 长度=2');
  assert(Array.isArray(d.jobPost.workDates) && d.jobPost.workDates.length === 1 && d.jobPost.workDates[0] === '周六', 'jobPost.workDates[0]=周六');
  assert(d.jobPost.status === 'PUBLISHED', `jobPost.status=PUBLISHED got=${d.jobPost.status}`);

  // b) status='DONE'
  assertEq(d.status, 'DONE', 'status=DONE');

  // c) contactedAt=null, fitMark=null
  assertEq(d.contactedAt, null, 'contactedAt=null');
  assertEq(d.fitMark, null, 'fitMark=null');

  // d) user.nickname 非空
  assert(!!d.user.nickname && d.user.nickname.length > 0, `user.nickname 非空 got=${d.user.nickname}`);

  // e) resume.completeness=100, missingFields 空数组
  assert(d.resume !== null, 'resume 非空');
  assertEq(d.resume.id, resumeId, 'resume.id 匹配');
  assertEq(d.resume.completeness, 100, 'resume.completeness=100');
  assert(Array.isArray(d.resume.missingFields) && d.resume.missingFields.length === 0, 'resume.missingFields 为空数组');
  for (const k of ['id', 'name', 'phone', 'selfIntro', 'skills', 'availabilities', 'experience', 'completeness', 'missingFields', 'updatedAt']) {
    assert(k in d.resume, `resume 字段齐: ${k}`);
  }

  // f) answers 长度=questions 长度=2, answer 字符串匹配
  assert(Array.isArray(d.answers) && d.answers.length === 2, `answers 长度=2 got=${d.answers?.length}`);
  assertEq(d.answers[0].question, '你的身份', 'answers[0].question');
  assertEq(d.answers[0].answer, '我在校大学生', 'answers[0].answer');
  assertEq(d.answers[1].question, '可到岗时间', 'answers[1].question');
  assertEq(d.answers[1].answer, '周六全天', 'answers[1].answer');

  // g) history 长度≥3：APPLY → 录用 → 完成
  assert(Array.isArray(d.history) && d.history.length >= 3, `history 长度≥3 got=${d.history?.length}`);
  // 验证字段
  for (const h of d.history) {
    for (const k of ['type', 'action', 'label', 'at']) {
      assert(k in h, `history item 字段齐: ${k}`);
    }
  }
  // 按 at 升序
  const ats = d.history.map((h) => new Date(h.at).getTime());
  for (let i = 1; i < ats.length; i++) {
    assert(ats[i] >= ats[i - 1], `history at 升序 idx ${i} (${ats[i]} >= ${ats[i - 1]})`);
  }
  // 第一条必须是 APPLY
  assertEq(d.history[0].type, 'STATUS', 'history[0].type=STATUS');
  assertEq(d.history[0].action, 'APPLY', 'history[0].action=APPLY');
  assertEq(d.history[0].label, '提交报名', 'history[0].label=提交报名');
  // 末两条分别为 录用 + 完成
  const last2 = d.history.slice(-2);
  const labels = last2.map((x) => x.label);
  assert(labels.includes('商家录用'), 'history 含 商家录用');
  assert(labels.includes('商家标记完成'), 'history 含 商家标记完成');
  // 出现的次序：录用 在 完成 之前
  const idxAccept = labels.indexOf('商家录用');
  const idxComplete = labels.indexOf('商家标记完成');
  assert(idxAccept < idxComplete, 'history 内 录用早于完成');

  // h) A 标记 contacted 并复查
  const mark1 = await call('POST', `/merchant/candidates/${appId}/contact`, A.accessToken, { contacted: true });
  assert(mark1.body.code === 0, 'A 标记 contacted=true');
  const detail2 = await call('GET', `/merchant/candidates/${appId}`, A.accessToken);
  assert(detail2.body.code === 0, 'contacted 后取详情');
  assert(detail2.body.data.contactedAt !== null, `contactedAt 非空 got=${detail2.body.data.contactedAt}`);
  const lastEntry = detail2.body.data.history[detail2.body.data.history.length - 1];
  assertEq(lastEntry.type, 'CONTACT', 'history 末尾 type=CONTACT');
  assertEq(lastEntry.label, '已标记联系', 'history 末尾 label=已标记联系');
  // at 升序保持
  const ats2 = detail2.body.data.history.map((h) => new Date(h.at).getTime());
  for (let i = 1; i < ats2.length; i++) {
    assert(ats2[i] >= ats2[i - 1], `history at 升序(接触后) idx ${i}`);
  }

  // i) A 标记 fitMark=FIT 并复查
  const mark2 = await call('POST', `/merchant/candidates/${appId}/fit`, A.accessToken, { fitMark: 'FIT' });
  assert(mark2.body.code === 0, 'A 标记 fitMark=FIT');
  const detail3 = await call('GET', `/merchant/candidates/${appId}`, A.accessToken);
  assert(detail3.body.code === 0, 'fitMark 后取详情');
  assertEq(detail3.body.data.fitMark, 'FIT', 'fitMark=FIT');
  // 时间线长度不变（fitMark 仅当前态，时间线不动）
  assertEq(detail3.body.data.history.length, detail2.body.data.history.length, 'history 长度不变（fitMark 不入时间线）');

  // j) 隔离：C 调 A 的报名 detail -> 403 / 10003
  const isoJ = await call('GET', `/merchant/candidates/${appId}`, C.accessToken);
  assert(isoJ.status === 403, `C 访问他人报名: HTTP 403 got=${isoJ.status}`);
  assertEq(isoJ.body.code, 10003, 'C 访问他人报名: code 10003');

  // k) 隔离：C 查不存在的 id -> 404 / 40001
  const isoK = await call('GET', `/merchant/candidates/notexist_${sfx}`, C.accessToken);
  assert(isoK.status === 404, `不存在 id: HTTP 404 got=${isoK.status}`);
  assertEq(isoK.body.code, 40001, '不存在 id: code 40001');

  // l) 隔离：未入驻用户 B 调 -> 404 / 60002
  // B 已建立完整简历并报名过，但未做 merchant.register —— 应该走 60002（先查 app 找到再校验当前用户是否入驻）
  // 实现：先查到 app，再查 B 的 merchant 记录（无），抛 60002
  const isoL = await call('GET', `/merchant/candidates/${appId}`, B.accessToken);
  assert(isoL.status === 404, `未入驻用户访问: HTTP 404 got=${isoL.status}`);
  assertEq(isoL.body.code, 60002, '未入驻用户访问: code 60002');

  // m) 隔离：未带 token -> 401
  const isoM = await call('GET', `/merchant/candidates/${appId}`, null);
  assert(isoM.status === 401, `未带 token: HTTP 401 got=${isoM.status}`);

  // 简历空场景：A 发岗 pid2 (questions 与 A 岗一致)，B2 不建简历，报名
  const post2 = await call('POST', '/job-posts', A.accessToken, {
    title: `M2-07岗位_nores_${sfx}`,
    description: 'no resumes',
    salary: '100/天',
    location: '校',
    category: 'CATERING',
    settlement: 'DAILY',
    questions: ['你的身份', '可到岗时间'],
    duration: 'D30',
  });
  assert(post2.body.code === 0, 'A 发岗2成功');
  const pid2 = post2.body.data.id;
  created.jobPostIds.push(pid2);
  const pay2 = await call('POST', '/payments/job-publish', A.accessToken, { jobPostId: pid2, duration: 'D30' });
  assert(pay2.body.code === 0, 'A 付费发布2');
  const orders2 = await prisma.paymentOrder.findMany({ where: { jobPostId: pid2 }, select: { id: true } });
  created.paymentOrderIds.push(...orders2.map((o) => o.id));

  const app2 = await call('POST', `/job-posts/${pid2}/applications`, B2.accessToken, {
    answers: ['身份空白简历', '周六全天'],
  });
  assert(app2.body.code === 0, 'B2 报名 pid2');
  const appId2 = app2.body.data.id;
  created.jobApplicationIds.push(appId2);

  const noRes = await call('GET', `/merchant/candidates/${appId2}`, A.accessToken);
  assert(noRes.body.code === 0, '无简历详情 code=0');
  assertEq(noRes.body.data.resume, null, '无简历 resume=null');

  // answers 空场景：A 发岗 pid3 (questions 空)，B2 不传 answers
  const post3 = await call('POST', '/job-posts', A.accessToken, {
    title: `M2-07岗位_noq_${sfx}`,
    description: 'no questions',
    salary: '120/天',
    location: '校',
    category: 'CATERING',
    settlement: 'DAILY',
    questions: [],
    duration: 'D30',
  });
  assert(post3.body.code === 0, 'A 发岗3成功');
  const pid3 = post3.body.data.id;
  created.jobPostIds.push(pid3);
  const pay3 = await call('POST', '/payments/job-publish', A.accessToken, { jobPostId: pid3, duration: 'D30' });
  assert(pay3.body.code === 0, 'A 付费发布3');
  const orders3 = await prisma.paymentOrder.findMany({ where: { jobPostId: pid3 }, select: { id: true } });
  created.paymentOrderIds.push(...orders3.map((o) => o.id));

  const app3 = await call('POST', `/job-posts/${pid3}/applications`, B2.accessToken, {});
  assert(app3.body.code === 0, 'B2 报名 pid3（空 answers）');
  const appId3 = app3.body.data.id;
  created.jobApplicationIds.push(appId3);

  const noAns = await call('GET', `/merchant/candidates/${appId3}`, A.accessToken);
  assert(noAns.body.code === 0, 'answers 空详情 code=0');
  assertEq(noAns.body.data.answers, null, 'answers=null');

  // 收集本次测试产生的通知（用于清理）
  const notifs = await prisma.notification.findMany({
    where: { targetId: { in: [appId, appId2, appId3] } },
    select: { id: true },
  });
  created.notificationIds.push(...notifs.map((n) => n.id));

  // 写 created JSON 供清理脚本读取
  const fs = await import('fs/promises');
  const outPath = `apps/server/scripts/_m2-07-cleanup-${sfx}.json`;
  await fs.writeFile(outPath, JSON.stringify({ sfx, ...created }, null, 2));
  console.log('\n[m2-07 candidate-detail smoke] ALL PASSED');
  console.log('  cleanup payload ->', outPath);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('\n[m2-07 candidate-detail smoke] STOPPED:', e.message);
  const fs = await import('fs/promises');
  try {
    const outPath = `apps/server/scripts/_m2-07-cleanup-${(globalThis.__sfx || 'unknown')}.json`;
    await fs.writeFile(outPath, JSON.stringify({ sfx: globalThis.__sfx, error: e.message, ...created }, null, 2));
  } catch (_) {}
  process.exit(1);
});
