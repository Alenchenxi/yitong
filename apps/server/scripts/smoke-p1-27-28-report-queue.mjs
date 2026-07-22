/**
 * P1-27 + P1-28 smoke：兼职投诉举报（岗位/商家/报名）+ 后台举报处理队列
 * 前置：server dev 模式；seed 已绑定 admin openid=mock_admin（login code='admin' role='admin'）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(14000); continue; }
    throw new Error(`login(${role}): ${JSON.stringify(j)}`);
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
  console.log('[P1-27+P1-28 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  // 商家 + 岗位 + 学生 A 报名 -> accept -> DONE
  const M = await login(`M${sfx}`, `Merchant_${sfx}`);
  await sleep(14000);
  await call('POST', '/merchant/register', M.accessToken, {
    shopName: `店铺_${sfx}`, licenseNo: `LIC${sfx}`, contactPhone: '13800000004',
  });
  const mProfile = await call('GET', '/merchant/profile', M.accessToken);
  const merchantId = mProfile.body.data.id;
  const post = await call('POST', '/job-posts', M.accessToken, {
    title: 'P1-27 测试岗位', description: '搬运', salary: '100/天', location: '学校',
    category: 'CATERING', settlement: 'DAILY', duration: 'D30',
  });
  const postId = post.body.data.id;
  await call('POST', '/payments/job-publish', M.accessToken, { jobPostId: postId, duration: 'D30' });

  const A = await login(`A${sfx}`, `StuA_${sfx}`);
  await sleep(14000);
  const appA = await call('POST', `/job-posts/${postId}/applications`, A.accessToken, {});
  const appIdA = appA.body.data.id;
  await call('POST', `/applications/${appIdA}/transition`, M.accessToken, { action: 'accept' });
  await call('POST', `/applications/${appIdA}/transition`, M.accessToken, { action: 'complete' });

  // ===== P1-27 三类举报 =====
  const rep1 = await call('POST', `/job-posts/${postId}/report`, A.accessToken, { reason: '岗位信息不实' });
  assert(rep1.body.code === 0 && rep1.body.data.reported, '举报岗位成功');
  const rep2 = await call('POST', `/merchants/${merchantId}/report`, A.accessToken, { reason: '商家资质存疑' });
  assert(rep2.body.code === 0 && rep2.body.data.reported, '举报商家成功');
  const rep3 = await call('POST', `/applications/${appIdA}/report`, A.accessToken, { reason: '拖欠薪资' });
  assert(rep3.body.code === 0 && rep3.body.data.reported, '学生投诉报名成功');

  // 商家也可投诉报名（当事人）
  const rep4 = await call('POST', `/applications/${appIdA}/report`, M.accessToken, { reason: '学生爽约' });
  assert(rep4.body.code === 0 && rep4.body.data.reported, '商家投诉报名成功');

  // 非当事人 B 投诉报名 -> 10003
  const B = await login(`B${sfx}`, `StuB_${sfx}`);
  await sleep(14000);
  const repB = await call('POST', `/applications/${appIdA}/report`, B.accessToken, { reason: '瞎举报' });
  assert(repB.body.code === 10003, `非当事人投诉被拒 10003 got ${repB.body.code}`);

  // ===== P1-28 后台处理队列 =====
  const admin = await login('admin', '管理员', 'admin');
  // 非 admin 访问 /admin/reports -> 10003
  const forbidden = await call('GET', '/admin/reports', A.accessToken);
  assert(forbidden.body.code === 10003, `非管理员访问被拒 10003 got ${forbidden.body.code}`);

  const queue = await call('GET', '/admin/reports?status=PENDING&pageSize=50', admin.accessToken);
  assert(queue.body.code === 0, 'admin 举报列表');
  const repJob = queue.body.data.list.find((r) => r.targetType === 'job_post' && r.targetId === postId);
  const repMer = queue.body.data.list.find((r) => r.targetType === 'merchant' && r.targetId === merchantId);
  const repApp = queue.body.data.list.filter((r) => r.targetType === 'application' && r.targetId === appIdA);
  assert(!!repJob, '队列含岗位举报');
  assert(!!repMer, '队列含商家举报');
  assert(repApp.length === 2, `队列含 2 条报名投诉 got ${repApp.length}`);
  assert(!!repJob.reporterNickname, `举报带 reporterNickname got ${repJob.reporterNickname}`);
  assert(/P1-27/.test(repJob.targetSummary), `岗位举报带 targetSummary got ${repJob.targetSummary}`);

  // approve + takedown：岗位举报成立并下架
  const res1 = await call('POST', `/admin/reports/${repJob.id}/resolve`, admin.accessToken, {
    action: 'approve', result: '核实属实', takedown: true,
  });
  assert(res1.body.code === 0 && res1.body.data.status === 'APPROVED', '举报处理 approve 成功');

  // 岗位已下架
  const postAfter = await call('GET', `/job-posts/${postId}`, A.accessToken);
  assert(postAfter.body.data.status === 'TAKEN_DOWN', `岗位已 TAKEN_DOWN got ${postAfter.body.data.status}`);

  // 举报人 A 收「举报 · 已受理」
  const notesA = await call('GET', '/notifications?page=1&pageSize=50', A.accessToken);
  const okNote = notesA.body.data.list.find((n) => n.type === 'report_result' && n.title.includes('已受理') && n.targetId === postId);
  assert(!!okNote, '举报人收到「举报 · 已受理」通知');

  // 商家收岗位下架通知
  const notesM = await call('GET', '/notifications?page=1&pageSize=50', M.accessToken);
  const downNote = notesM.body.data.list.find((n) => n.title.includes('岗位下架') && n.targetId === postId);
  assert(!!downNote, '商家收到岗位下架通知');

  // reject：报名投诉（学生那条）驳回
  const stuReport = repApp.find((r) => r.reporterId !== undefined && r.reason === '拖欠薪资');
  const res2 = await call('POST', `/admin/reports/${stuReport.id}/resolve`, admin.accessToken, {
    action: 'reject', result: '证据不足',
  });
  assert(res2.body.code === 0 && res2.body.data.status === 'REJECTED', '举报处理 reject 成功');
  const notesA2 = await call('GET', '/notifications?page=1&pageSize=50', A.accessToken);
  const rejNote = notesA2.body.data.list.find((n) => n.type === 'report_result' && n.title.includes('未通过') && n.targetId === appIdA);
  assert(!!rejNote, '举报人收到「举报 · 未通过」通知');

  // 重复处理 -> 40004
  const res3 = await call('POST', `/admin/reports/${repJob.id}/resolve`, admin.accessToken, { action: 'approve' });
  assert(res3.body.code === 40004, `重复处理被拒 40004 got ${res3.body.code}`);

  // 列表状态筛选：APPROVED 含刚处理的
  const done = await call('GET', '/admin/reports?status=APPROVED&pageSize=50', admin.accessToken);
  assert(done.body.data.list.some((r) => r.id === repJob.id && r.resolvedAt), 'APPROVED 列表含已处理举报（带 resolvedAt）');

  console.log('\n[P1-27+P1-28 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-27+P1-28 smoke] STOPPED:', e.message);
  process.exit(1);
});
