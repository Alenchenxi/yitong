/**
 * P2-10 smoke：群成员管理（前端 UI 调用的 3 条后端路径联通性 + 行为契约）
 * 场景：A(群主) 建群，B、C 加入（MEMBER）
 *   1. A 设 B 为 ADMIN（POST members/:anonId/role {role:'ADMIN'}）→ 详情 B=ADMIN
 *   2. A 设 B 回 MEMBER → 详情 B=MEMBER
 *   3. A 禁言 B 3 天（POST members/:anonId/mute {days:3}）→ mutedUntil 非空且在未来
 *   4. A 解除禁言（days=0）→ mutedUntil 为 null
 *   5. A 踢出 C（POST members/:anonId/kick）→ 详情无 C、memberCount 减 1
 *   6. MEMBER(B) 设角色 → 10003/403；MEMBER(B) 踢人 → 10003/403
 *   7. 禁言天数非法（31）→ 30004/400
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
  console.log('[P2-10-member-ui smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Owner_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `MemberB_${sfx}`);
  await sleep(14000);
  const C = await login(`C${sfx}`, `MemberC_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  const atC = await call('POST', '/treehole/anonymous-token', C.accessToken);
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken;
  const anonB = atB.body.data.anonId, anonC = atC.body.data.anonId;

  // A 建群，B、C 加入
  const create = await call('POST', '/treehole/groups', tokA, { name: `P2-10成员管理群_${sfx}`, maxMembers: 50 });
  assert(create.body.code === 0, 'A 建群');
  const gid = create.body.data.id;
  const joinB = await call('POST', `/treehole/groups/${gid}/join`, tokB);
  assert(joinB.body.code === 0, 'B 加入群');
  const joinC = await call('POST', `/treehole/groups/${gid}/join`, atC.body.data.anonToken);
  assert(joinC.body.code === 0, 'C 加入群');

  const getDetail = async () => {
    const d = await call('GET', `/treehole/groups/${gid}`, tokA);
    assert(d.body.code === 0, '查群详情');
    return d.body.data;
  };
  const roleOf = (detail, anonId) => {
    const m = detail.members.find((x) => x.anonId === anonId);
    return m ? m.role : null;
  };

  // 6a. MEMBER(B) 尝试设角色 → 10003 / 403（提前测，B 此时还是 MEMBER）
  const r0 = await call('POST', `/treehole/groups/${gid}/members/${anonC}/role`, tokB, { role: 'ADMIN' });
  assert(r0.status === 403 && r0.body.code === 10003, `MEMBER 设角色 10003/403 got code=${r0.body.code} status=${r0.status}`);

  // 6b. MEMBER(B) 尝试踢人 → 10003 / 403
  const k0 = await call('POST', `/treehole/groups/${gid}/members/${anonC}/kick`, tokB);
  assert(k0.status === 403 && k0.body.code === 10003, `MEMBER 踢人 10003/403 got code=${k0.body.code} status=${k0.status}`);

  // 1. A 设 B 为 ADMIN
  const r1 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/role`, tokA, { role: 'ADMIN' });
  assert(r1.body.code === 0, `A 设 B 为 ADMIN code=0 got ${JSON.stringify(r1.body)}`);
  let detail = await getDetail();
  assert(roleOf(detail, anonB) === 'ADMIN', `详情里 B 是 ADMIN got ${roleOf(detail, anonB)}`);

  // 2. A 设 B 回 MEMBER
  const r2 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/role`, tokA, { role: 'MEMBER' });
  assert(r2.body.code === 0, 'A 设 B 回 MEMBER code=0');
  detail = await getDetail();
  assert(roleOf(detail, anonB) === 'MEMBER', `详情里 B 是 MEMBER got ${roleOf(detail, anonB)}`);

  // 3. A 禁言 B 3 天 → mutedUntil 非空且在未来
  const m1 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/mute`, tokA, { days: 3 });
  assert(m1.body.code === 0, `A 禁言 B 3 天 code=0 got ${JSON.stringify(m1.body)}`);
  const mutedUntil = m1.body.data.mutedUntil;
  assert(!!mutedUntil && new Date(mutedUntil).getTime() > Date.now(), `mutedUntil 非空且在未来 got ${mutedUntil}`);
  detail = await getDetail();
  const memB = detail.members.find((x) => x.anonId === anonB);
  assert(!!memB.mutedUntil && new Date(memB.mutedUntil).getTime() > Date.now(), `详情里 B.mutedUntil 在未来 got ${memB.mutedUntil}`);

  // 4. A 解除禁言（days=0）→ mutedUntil 为 null
  const m2 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/mute`, tokA, { days: 0 });
  assert(m2.body.code === 0, 'A 解除禁言 code=0');
  assert(m2.body.data.mutedUntil === null, `mutedUntil 为 null got ${m2.body.data.mutedUntil}`);
  detail = await getDetail();
  const memB2 = detail.members.find((x) => x.anonId === anonB);
  assert(memB2.mutedUntil === null, `详情里 B.mutedUntil 为 null got ${memB2.mutedUntil}`);

  // 5. A 踢出 C → 详情无 C、memberCount 减 1
  const before = (await getDetail()).memberCount;
  const k1 = await call('POST', `/treehole/groups/${gid}/members/${anonC}/kick`, tokA);
  assert(k1.body.code === 0, `A 踢出 C code=0 got ${JSON.stringify(k1.body)}`);
  detail = await getDetail();
  assert(!detail.members.find((x) => x.anonId === anonC), '详情成员无 C');
  assert(detail.memberCount === before - 1, `memberCount 减 1（${before} -> ${detail.memberCount}）`);

  // 7. 禁言天数非法（31）→ 30004 / 400
  const m3 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/mute`, tokA, { days: 31 });
  assert(m3.status === 400 && m3.body.code === 30004, `禁言 31 天 30004/400 got code=${m3.body.code} status=${m3.status}`);

  console.log('\n[P2-10-member-ui smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-10-member-ui smoke] STOPPED:', e.message);
  process.exit(1);
});
