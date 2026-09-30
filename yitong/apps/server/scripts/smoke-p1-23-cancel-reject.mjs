/**
 * P1-23 + P1-24 smoke：用户取消报名 + 商家拒绝后用户收通知
 * 前置：server 正常运行（dev 模式，mock 支付 + 自动审核商家）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
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
  return { status: r.status, body: await r.json() };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[P1-23+P1-24 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  // 商家注册（dev 自动审核 APPROVED）
  const M = await login(`M${sfx}`, `Merchant_${sfx}`);
  await sleep(14000);
  const reg = await call('POST', '/merchant/register', M.accessToken, {
    shopName: `店铺_${sfx}`,
    licenseNo: `LIC${sfx}`,
    contactPhone: '13800000001',
  });
  assert(reg.body.code === 0, '商家注册成功（dev 自动 APPROVED）');

  // 发岗位草稿
  const post = await call('POST', '/job-posts', M.accessToken, {
    title: 'P1-23 测试岗位',
    description: '搬运货物',
    salary: '100/天',
    location: '学校',
    category: 'CATERING',
    settlement: 'DAILY',
    duration: 'D30',
  });
  assert(post.body.code === 0, '创建岗位草稿');
  const postId = post.body.data.id;

  // 付费发布（dev mock 自动发布）
  const pub = await call('POST', '/payments/job-publish', M.accessToken, { jobPostId: postId, duration: 'D30' });
  assert(pub.body.code === 0, '付费发布岗位（dev mock 自动 PUBLISHED）');
  assert(pub.body.data.jobPostStatus === 'PUBLISHED', '岗位状态 PUBLISHED');

  // 学生 A、B 报名
  const A = await login(`A${sfx}`, `StuA_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `StuB_${sfx}`);
  const appA = await call('POST', `/job-posts/${postId}/applications`, A.accessToken, {});
  assert(appA.body.code === 0, '学生 A 报名');
  const appB = await call('POST', `/job-posts/${postId}/applications`, B.accessToken, {});
  assert(appB.body.code === 0, '学生 B 报名');
  const appIdA = appA.body.data.id;
  const appIdB = appB.body.data.id;

  // ===== P1-23 取消报名 =====
  // 1) 别人的报名不能取消（A 试取消 B 的）-> 10003
  const cancelOther = await call('POST', `/applications/${appIdB}/cancel`, A.accessToken);
  assert(cancelOther.body.code === 10003, `他人报名取消被拒 10003 got ${cancelOther.body.code}`);

  // 2) A 取消自己的报名 -> status=CANCELLED
  const cancelA = await call('POST', `/applications/${appIdA}/cancel`, A.accessToken);
  assert(cancelA.body.code === 0, 'A 取消报名成功');
  assert(cancelA.body.data.status === 'CANCELLED', `A 状态 CANCELLED got ${cancelA.body.data.status}`);

  // 3) 重复取消（CANCELLED -> CANCELLED）-> 40004 状态非法
  const cancelAgain = await call('POST', `/applications/${appIdA}/cancel`, A.accessToken);
  assert(cancelAgain.body.code === 40004, `重复取消被拒 40004 got ${cancelAgain.body.code}`);

  // 4) 商家端报名列表应见 A 状态 CANCELLED
  const listApps = await call('GET', `/job-posts/${postId}/applications`, M.accessToken);
  const aInList = listApps.body.data.find((x) => x.id === appIdA);
  assert(aInList && aInList.status === 'CANCELLED', '商家列表见 A=CANCELLED');

  // 5) 商家收到取消通知（type=JOB_APPLY，title=报名已取消）
  const notes = await call('GET', '/notifications?page=1&pageSize=50', M.accessToken);
  assert(notes.body.code === 0, '商家通知列表');
  const cancelNote = notes.body.data.list.find(
    (n) => n.title === '报名已取消' && n.targetType === 'job_post' && n.targetId === postId,
  );
  assert(!!cancelNote, '商家收到「报名已取消」通知');

  // ===== P1-24 未录用通知 =====
  // 商家拒绝 B 的报名
  const rejB = await call('POST', `/applications/${appIdB}/transition`, M.accessToken, { action: 'reject' });
  assert(rejB.body.code === 0, '商家 reject B');
  assert(rejB.body.data.status === 'REJECTED', `B 状态 REJECTED got ${rejB.body.data.status}`);

  // B 收到 JOB_REJECT 通知
  const notesB = await call('GET', '/notifications?page=1&pageSize=50', B.accessToken);
  const rejectNote = notesB.body.data.list.find(
    (n) => n.type === 'job_reject' && n.targetType === 'application' && n.targetId === appIdB,
  );
  assert(!!rejectNote, 'B 收到 job_reject 通知');
  assert(/未录用/.test(rejectNote.content) && /P1-23/.test(rejectNote.content), `通知 content 含岗位名 got: ${rejectNote.content}`);

  // 取消后的报名（A）商家不能再 reject -> 40004
  const rejCancelled = await call('POST', `/applications/${appIdA}/transition`, M.accessToken, { action: 'reject' });
  assert(rejCancelled.body.code === 40004, `CANCELLED 报名不能再 reject 40004 got ${rejCancelled.body.code}`);

  console.log('\n[P1-23+P1-24 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-23+P1-24 smoke] STOPPED:', e.message);
  process.exit(1);
});