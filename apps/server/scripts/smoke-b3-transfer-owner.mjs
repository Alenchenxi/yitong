/**
 * B3 smoke：群主转交 transferOwner
 * 场景：A(群主) 建群，B 加入；A 转交给 B；A 再转交被拒(10003)；
 *       B 转交给非成员 C anonId(30009)；B 转交给自己(30004)；事务后恰好 1 个 OWNER。
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
  console.log('[B3-transfer smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Owner_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `Member_${sfx}`);
  await sleep(14000);
  const C = await login(`C${sfx}`, `Outsider_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  const atC = await call('POST', '/treehole/anonymous-token', C.accessToken);
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken;
  const anonA = atA.body.data.anonId, anonB = atB.body.data.anonId, anonC = atC.body.data.anonId;

  // A 建群，B 加入（C 不加入，作为非成员）
  const create = await call('POST', '/treehole/groups', tokA, { name: `B3转交群_${sfx}`, maxMembers: 50 });
  const gid = create.body.data.id;
  const joinB = await call('POST', `/treehole/groups/${gid}/join`, tokB);
  assert(joinB.body.code === 0, 'B 加入群');

  // B(非群主) 转交 → 10003 / 403
  const t0 = await call('POST', `/treehole/groups/${gid}/transfer`, tokB, { targetAnonId: anonA });
  assert(t0.status === 403 && t0.body.code === 10003, `非群主转交 10003/403 got code=${t0.body.code} status=${t0.status}`);

  // A 转交给 B → 200
  const t1 = await call('POST', `/treehole/groups/${gid}/transfer`, tokA, { targetAnonId: anonB });
  assert(t1.status === 201 || t1.status === 200, `A 转交 B HTTP 2xx got ${t1.status}`);
  assert(t1.body.code === 0 && t1.body.data.newOwner === anonB, `转交返回 newOwner=B got ${JSON.stringify(t1.body)}`);

  // 查群详情：B=OWNER、A=MEMBER、ownerAnonId=B、恰好 1 个 OWNER
  const detail = await call('GET', `/treehole/groups/${gid}`, tokA);
  assert(detail.body.code === 0, '查群详情');
  assert(detail.body.data.ownerAnonId === anonB, `ownerAnonId=B got ${detail.body.data.ownerAnonId}`);
  const memA = detail.body.data.members.find((m) => m.anonId === anonA);
  const memB = detail.body.data.members.find((m) => m.anonId === anonB);
  assert(memB && memB.role === 'OWNER', `B 角色 OWNER got ${memB && memB.role}`);
  assert(memA && memA.role === 'MEMBER', `A 角色 MEMBER got ${memA && memA.role}`);
  const ownerCount = detail.body.data.members.filter((m) => m.role === 'OWNER').length;
  assert(ownerCount === 1, `恰好 1 个 OWNER got ${ownerCount}`);

  // A(已降 MEMBER) 再尝试转交 → 10003 / 403
  const t2 = await call('POST', `/treehole/groups/${gid}/transfer`, tokA, { targetAnonId: anonB });
  assert(t2.status === 403 && t2.body.code === 10003, `降级后 A 转交 10003/403 got code=${t2.body.code} status=${t2.status}`);

  // B(新群主) 转交给非成员 C 的 anonId → 30009 / 404
  const t3 = await call('POST', `/treehole/groups/${gid}/transfer`, tokB, { targetAnonId: anonC });
  assert(t3.status === 404 && t3.body.code === 30009, `转交非成员 30009/404 got code=${t3.body.code} status=${t3.status}`);

  // B 转交给自己（已是群主）→ 30004 / 400
  const t4 = await call('POST', `/treehole/groups/${gid}/transfer`, tokB, { targetAnonId: anonB });
  assert(t4.status === 400 && t4.body.code === 30004, `转交给自己 30004/400 got code=${t4.body.code} status=${t4.status}`);

  // 失败操作后状态未变：仍 B=OWNER、A=MEMBER、1 个 OWNER
  const d2 = await call('GET', `/treehole/groups/${gid}`, tokB);
  assert(d2.body.data.ownerAnonId === anonB, '失败后 ownerAnonId 仍为 B');
  const ownerCount2 = d2.body.data.members.filter((m) => m.role === 'OWNER').length;
  assert(ownerCount2 === 1, `失败后仍恰好 1 个 OWNER got ${ownerCount2}`);
  const memA2 = d2.body.data.members.find((m) => m.anonId === anonA);
  assert(memA2 && memA2.role === 'MEMBER', '失败后 A 仍为 MEMBER');

  console.log('\n[B3-transfer smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[B3-transfer smoke] STOPPED:', e.message);
  process.exit(1);
});
