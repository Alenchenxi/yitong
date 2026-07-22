/**
 * P2-12 + P2-13 smoke：加入申请 + 群举报
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
  console.log('[P2-12+P2-13 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Owner_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `Applicant_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken;
  const anonA = atA.body.data.anonId;

  // A 建私密群
  const create = await call('POST', '/treehole/groups', tokA, { name: `私密群_${sfx}`, isPrivate: true, maxMembers: 10 });
  const gid = create.body.data.id;

  // 公开群直接申请被拒 30004
  const pub = await call('POST', '/treehole/groups', tokA, { name: `公开群_${sfx}`, isPrivate: false });
  const pubApply = await call('POST', `/treehole/groups/${pub.body.data.id}/apply`, tokB, { message: 'hi' });
  assert(pubApply.body.code === 30004, `公开群申请 30004 got ${pubApply.body.code}`);

  // B 申请加入私密群
  const apply = await call('POST', `/treehole/groups/${gid}/apply`, tokB, { message: '想加入' });
  assert(apply.body.code === 0, 'B 申请加入');
  const reqId = apply.body.data.id;

  // 重复申请 PENDING 30004
  const dupApply = await call('POST', `/treehole/groups/${gid}/apply`, tokB, { message: 'again' });
  assert(dupApply.body.code === 30004, `重复 PENDING 申请 30004 got ${dupApply.body.code}`);

  // 非成员查申请列表 10003
  const outList = await call('GET', `/treehole/groups/${gid}/requests`, tokB);
  assert(outList.body.code === 10003, `非成员查列表 10003 got ${outList.body.code}`);

  // OWNER 查 PENDING 列表
  const list = await call('GET', `/treehole/groups/${gid}/requests`, tokA);
  assert(list.body.code === 0, 'OWNER 查列表');
  assert(list.body.data.find((r) => r.id === reqId), '列表含该申请');
  assert(!!list.body.data.find((r) => r.id === reqId).nickname, '列表带昵称');

  // OWNER approve
  const approve = await call('POST', `/treehole/groups/${gid}/requests/${reqId}/review`, tokA, { action: 'approve' });
  assert(approve.body.code === 0, 'OWNER 批准申请');

  // B 现在是成员
  const detail = await call('GET', `/treehole/groups/${gid}`, tokB);
  assert(detail.body.data.members.some((m) => m.anonId === atB.body.data.anonId), 'B 加入成为成员');
  assert(detail.body.data.memberCount === 2, `memberCount=2 got ${detail.body.data.memberCount}`);

  // C 申请再 reject
  const C = await login(`C${sfx}`, `C_${sfx}`);
  await sleep(14000);
  const atC = await call('POST', '/treehole/anonymous-token', C.accessToken);
  const apply2 = await call('POST', `/treehole/groups/${gid}/apply`, atC.body.data.anonToken, { message: '也想加入' });
  const req2 = apply2.body.data.id;
  const reject = await call('POST', `/treehole/groups/${gid}/requests/${req2}/review`, tokA, { action: 'reject' });
  assert(reject.body.code === 0, 'OWNER 拒绝申请');

  // C 不应是成员
  const detail2 = await call('GET', `/treehole/groups/${gid}`, atC.body.data.anonToken);
  assert(detail2.body.code === 30007, '被拒后 C 仍非成员');

  // 重复审批已处理 30004
  const dupReview = await call('POST', `/treehole/groups/${gid}/requests/${reqId}/review`, tokA, { action: 'approve' });
  assert(dupReview.body.code === 30004, `重复审批 30004 got ${dupReview.body.code}`);

  // ===== P2-13 群举报 =====
  const rep = await call('POST', `/treehole/groups/${gid}/report`, tokB, { reason: '违规内容' });
  assert(rep.body.code === 0, 'B 举报群聊');

  // 不存在群举报 30010
  const repNo = await call('POST', `/treehole/groups/cmx_no/report`, tokB, { reason: 'x' });
  assert(repNo.body.code === 30010, `举报不存在群 30010 got ${repNo.body.code}`);

  console.log('\n[P2-12+P2-13 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-12+P2-13 smoke] STOPPED:', e.message);
  process.exit(1);
});
