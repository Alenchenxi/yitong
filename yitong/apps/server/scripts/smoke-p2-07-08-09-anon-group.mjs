/**
 * P2-07 + P2-08 + P2-09 smoke：群聊广场 + 创建群聊 + 群聊详情
 * 前置：server dev 模式（mock 内容审核）
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
  console.log('[P2-07+P2-08+P2-09 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `UserA_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `UserB_${sfx}`);
  await sleep(14000);

  // 拿 anon token
  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  const tokA = atA.body.data.anonToken;
  const tokB = atB.body.data.anonToken;
  const anonB = atB.body.data.anonId;

  // ===== P2-08 创建群聊 =====
  const create = await call('POST', '/treehole/groups', tokA, {
    name: `P2群_${sfx}`,
    description: '测试群',
    tags: ['情感', '闲聊'],
    maxMembers: 50,
  });
  assert(create.body.code === 0, '创建群聊成功');
  const gid = create.body.data.id;
  assert(create.body.data.ownerAnonId === atA.body.data.anonId, 'ownerAnonId=创建者');
  assert(create.body.data.memberCount === 1, 'memberCount=1');
  assert(create.body.data.isMember === true, '创建者 isMember=true');
  assert(create.body.data.maxMembers === 50, 'maxMembers 持久化');

  // 名称超长
  const longName = await call('POST', '/treehole/groups', tokA, { name: 'x'.repeat(31) });
  assert(longName.body.code === 30004, `超长名称 30004 got ${longName.body.code}`);
  // 人数超界
  const badMax = await call('POST', '/treehole/groups', tokA, { name: 'x', maxMembers: 1 });
  assert(badMax.body.code === 30004, `人数 1 拒绝 30004 got ${badMax.body.code}`);

  // ===== P2-09 群聊详情 =====
  const detail = await call('GET', `/treehole/groups/${gid}`, tokA);
  assert(detail.body.code === 0, '详情 200');
  assert(detail.body.data.name === `P2群_${sfx}`, '详情 name 正确');
  assert(detail.body.data.members.length === 1, '详情成员 1');
  assert(detail.body.data.members[0].role === 'OWNER', 'OWNER');
  assert(detail.body.data.members[0].nickname !== '', '成员带匿名昵称');

  // ===== P2-07 群聊广场 =====
  const list = await call('GET', '/treehole/groups?sort=recommend&limit=20', tokA);
  assert(list.body.code === 0, '广场列表');
  assert(list.body.data.find((g) => g.id === gid), '广场含该群');
  const listed = list.body.data.find((g) => g.id === gid);
  assert(listed.isMember === true, '广场中 isMember=true（创建者）');

  // 创建私密群（广场不可见）
  const priv = await call('POST', '/treehole/groups', tokA, {
    name: `私密群_${sfx}`, isPrivate: true, maxMembers: 10,
  });
  const privId = priv.body.data.id;
  const list2 = await call('GET', '/treehole/groups?sort=recommend&limit=50', tokA);
  assert(!list2.body.data.find((g) => g.id === privId), '私密群不进广场');

  // B 详情私密群 30007
  const privDetail = await call('GET', `/treehole/groups/${privId}`, tokB);
  assert(privDetail.body.code === 30007, `私密群非成员详情被拒 30007 got ${privDetail.body.code}`);

  // B 加入公开群
  const join = await call('POST', `/treehole/groups/${gid}/join`, tokB);
  assert(join.body.code === 0, 'B 加入公开群');
  assert(join.body.data.joined === true, 'joined=true');
  // 重复加入 30009
  const dupJoin = await call('POST', `/treehole/groups/${gid}/join`, tokB);
  assert(dupJoin.body.code === 30009, `重复加入 30009 got ${dupJoin.body.code}`);
  // B 加入私密群被拒 30007
  const privJoin = await call('POST', `/treehole/groups/${privId}/join`, tokB);
  assert(privJoin.body.code === 30007, `私密加入被拒 30007 got ${privJoin.body.code}`);
  // 不存在群 30010
  const noGroup = await call('POST', `/treehole/groups/cmx_no/join`, tokB);
  assert(noGroup.body.code === 30010, `不存在群 30010 got ${noGroup.body.code}`);

  // 详情：成员 2，isMember(B)=true
  const detail2 = await call('GET', `/treehole/groups/${gid}`, tokB);
  assert(detail2.body.data.members.length === 2, '成员 2');
  assert(detail2.body.data.memberCount === 2, 'memberCount=2');

  // ===== 我的群聊 =====
  const myA = await call('GET', '/treehole/groups/mine', tokA);
  assert(myA.body.data.find((g) => g.id === gid), 'A 我的含该群');
  const myB = await call('GET', '/treehole/groups/mine', tokB);
  assert(myB.body.data.find((g) => g.id === gid), 'B 我的含该群');
  assert(!myB.body.data.find((g) => g.id === privId), 'B 不含私密群');

  // B 退出
  const leave = await call('POST', `/treehole/groups/${gid}/leave`, tokB);
  assert(leave.body.code === 0 && leave.body.data.left === true, 'B 退出成功');
  // B 重复退出 30009
  const dupLeave = await call('POST', `/treehole/groups/${gid}/leave`, tokB);
  assert(dupLeave.body.code === 30009, `重复退出 30009 got ${dupLeave.body.code}`);
  // 退出后 memberCount 回到 1
  const detail3 = await call('GET', `/treehole/groups/${gid}`, tokA);
  assert(detail3.body.data.memberCount === 1, '退出后 memberCount=1');

  // A 退出（OWNER）= 解散群
  const leaveA = await call('POST', `/treehole/groups/${gid}/leave`, tokA);
  assert(leaveA.body.code === 0 && leaveA.body.data.disbanded === true, 'OWNER 退出=解散');
  // 解散后广场不可见
  const list3 = await call('GET', '/treehole/groups?sort=recommend&limit=50', tokA);
  assert(!list3.body.data.find((g) => g.id === gid), '解散后广场不可见');

  console.log('\n[P2-07+P2-08+P2-09 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-07+P2-08+P2-09 smoke] STOPPED:', e.message);
  process.exit(1);
});
