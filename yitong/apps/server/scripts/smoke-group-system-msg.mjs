/**
 * 群系统消息广播 smoke：验证 9 类动作触发系统消息落库 + 历史可拉取 + 匿名红线 + 业务动作仍生效。
 * 场景（A 群主，B/C 成员）：
 *   1. A 建群        -> group_created     (actor=A, 无 target)
 *   2. B 加入        -> member_joined     (actor=B)
 *   3. C 加入        -> member_joined     (actor=C)
 *   4. A 设 B ADMIN  -> role_admin        (actor=A, target=B) + 详情 B=ADMIN
 *   5. A 取消 B      -> role_member       (actor=A, target=B) + 详情 B=MEMBER
 *   6. A 禁言 B 3 天 -> member_muted      (actor=A, target=B, extra.days=3) + mutedUntil 未来
 *   7. A 解除 B      -> member_unmuted    (actor=A, target=B) + mutedUntil null
 *   8. A 踢 C        -> member_kicked     (actor=A, target=C) + 详情无 C / memberCount-1
 *   9. A 转交 B      -> owner_transferred (actor=A, target=B) + ownerAnonId=B / B=OWNER / A=MEMBER
 * 红线：每条系统消息 fromId==='system'；actor/target.anonId 以 'anon_' 开头（不含真实 uid）。
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

// 拉群历史（公开群不校验成员；list 正序 旧->新，最新在末尾）
async function fetchHistory(token, gid) {
  const r = await call('GET', `/treehole/groups/${gid}/messages?limit=200`, token);
  assert(r.body.code === 0, `拉历史 code=0 got ${JSON.stringify(r.body)}`);
  return r.body.data.list;
}
// 取最新一条系统消息
function latestSystem(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].type === 'system') return list[i];
  }
  return null;
}
// 校验系统消息红线 + 解析 content
function checkSystem(msg, expectedAction) {
  assert(!!msg, `存在系统消息 (action=${expectedAction})`);
  assert(msg.fromId === 'system', `fromId='system' got ${msg.fromId}`);
  assert(msg.type === 'system', `type='system' got ${msg.type}`);
  let d;
  try { d = JSON.parse(msg.content); } catch { assert(false, `content JSON 可解析 action=${expectedAction}`); }
  assert(d.action === expectedAction, `action=${expectedAction} got ${d.action}`);
  // 红线：actor/target 仅 anonId+nick，anonId 以 anon_ 开头（不含真实 uid）
  assertAnon(d.actor, 'actor');
  if (d.target !== undefined && d.target !== null) assertAnon(d.target, 'target');
  return d;
}
function assertAnon(obj, label) {
  assert(typeof obj === 'object' && obj !== null, `${label} 存在`);
  assert(typeof obj.anonId === 'string' && obj.anonId.startsWith('anon_'), `${label}.anonId anon_ 前缀 got ${obj.anonId}`);
  assert(typeof obj.nick === 'string' && obj.nick.length > 0, `${label}.nick 非空`);
}

(async () => {
  console.log('[group-system-msg smoke] base =', BASE);
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
  assert(atA.body.code === 0, 'A 匿名 token');
  assert(atB.body.code === 0, 'B 匿名 token');
  assert(atC.body.code === 0, 'C 匿名 token');
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken, tokC = atC.body.data.anonToken;
  const anonA = atA.body.data.anonId, anonB = atB.body.data.anonId, anonC = atC.body.data.anonId;
  const nickA = atA.body.data.nickname, nickB = atB.body.data.nickname, nickC = atC.body.data.nickname;
  console.log('  anonA=%s nick=%s | anonB=%s nick=%s | anonC=%s nick=%s', anonA, nickA, anonB, nickB, anonC, nickC);

  // 1. A 建群（公开群）
  const create = await call('POST', '/treehole/groups', tokA, { name: `系统消息群_${sfx}`, maxMembers: 50 });
  assert(create.body.code === 0, `A 建群 code=0 got ${JSON.stringify(create.body)}`);
  const gid = create.body.data.id;
  let list = await fetchHistory(tokA, gid);
  let sys = latestSystem(list);
  let d = checkSystem(sys, 'group_created');
  assert(d.actor.anonId === anonA, `group_created actor=A got ${d.actor.anonId}`);
  assert(d.actor.nick === nickA, `group_created actor.nick=A 昵称 got ${d.actor.nick}`);
  assert(d.target === undefined || d.target === null, 'group_created 无 target');

  // 2. B 加入
  const joinB = await call('POST', `/treehole/groups/${gid}/join`, tokB);
  assert(joinB.body.code === 0, 'B 加入群 code=0');
  list = await fetchHistory(tokA, gid);
  sys = latestSystem(list);
  d = checkSystem(sys, 'member_joined');
  assert(d.actor.anonId === anonB, `member_joined actor=B got ${d.actor.anonId}`);
  assert(d.actor.nick === nickB, `member_joined actor.nick=B 昵称 got ${d.actor.nick}`);

  // 3. C 加入
  const joinC = await call('POST', `/treehole/groups/${gid}/join`, tokC);
  assert(joinC.body.code === 0, 'C 加入群 code=0');
  list = await fetchHistory(tokA, gid);
  sys = latestSystem(list);
  d = checkSystem(sys, 'member_joined');
  assert(d.actor.anonId === anonC, `member_joined(actor=C) got ${d.actor.anonId}`);
  assert(d.actor.nick === nickC, `member_joined actor.nick=C 昵称 got ${d.actor.nick}`);

  const getDetail = async () => {
    const r = await call('GET', `/treehole/groups/${gid}`, tokA);
    assert(r.body.code === 0, '查群详情 code=0');
    return r.body.data;
  };
  const roleOf = (detail, aid) => {
    const m = detail.members.find((x) => x.anonId === aid);
    return m ? m.role : null;
  };

  // 4. A 设 B 为 ADMIN -> role_admin + 详情 B=ADMIN
  const r1 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/role`, tokA, { role: 'ADMIN' });
  assert(r1.body.code === 0, `A 设 B ADMIN code=0 got ${JSON.stringify(r1.body)}`);
  list = await fetchHistory(tokA, gid);
  d = checkSystem(latestSystem(list), 'role_admin');
  assert(d.actor.anonId === anonA && d.target.anonId === anonB, 'role_admin actor=A target=B');
  assert(d.target.nick === nickB, `role_admin target.nick=B 昵称 got ${d.target.nick}`);
  let detail = await getDetail();
  assert(roleOf(detail, anonB) === 'ADMIN', `详情 B=ADMIN got ${roleOf(detail, anonB)}`);

  // 5. A 取消 B -> role_member + 详情 B=MEMBER
  const r2 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/role`, tokA, { role: 'MEMBER' });
  assert(r2.body.code === 0, 'A 取消 B MEMBER code=0');
  list = await fetchHistory(tokA, gid);
  d = checkSystem(latestSystem(list), 'role_member');
  assert(d.actor.anonId === anonA && d.target.anonId === anonB, 'role_member actor=A target=B');
  detail = await getDetail();
  assert(roleOf(detail, anonB) === 'MEMBER', `详情 B=MEMBER got ${roleOf(detail, anonB)}`);

  // 6. A 禁言 B 3 天 -> member_muted extra.days=3 + mutedUntil 未来
  const m1 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/mute`, tokA, { days: 3 });
  assert(m1.body.code === 0, `A 禁言 B 3 天 code=0 got ${JSON.stringify(m1.body)}`);
  assert(!!m1.body.data.mutedUntil && new Date(m1.body.data.mutedUntil).getTime() > Date.now(), `mutedUntil 未来 got ${m1.body.data.mutedUntil}`);
  list = await fetchHistory(tokA, gid);
  d = checkSystem(latestSystem(list), 'member_muted');
  assert(d.actor.anonId === anonA && d.target.anonId === anonB, 'member_muted actor=A target=B');
  assert(d.extra && d.extra.days === 3, `member_muted extra.days=3 got ${JSON.stringify(d.extra)}`);

  // 7. A 解除 B -> member_unmuted + mutedUntil null
  const m2 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/mute`, tokA, { days: 0 });
  assert(m2.body.code === 0, 'A 解除 B 禁言 code=0');
  assert(m2.body.data.mutedUntil === null, `mutedUntil=null got ${m2.body.data.mutedUntil}`);
  list = await fetchHistory(tokA, gid);
  d = checkSystem(latestSystem(list), 'member_unmuted');
  assert(d.actor.anonId === anonA && d.target.anonId === anonB, 'member_unmuted actor=A target=B');

  // 8. A 踢 C -> member_kicked actor=A target=C + 详情无 C + memberCount-1
  const before = (await getDetail()).memberCount;
  const k1 = await call('POST', `/treehole/groups/${gid}/members/${anonC}/kick`, tokA);
  assert(k1.body.code === 0, `A 踢 C code=0 got ${JSON.stringify(k1.body)}`);
  list = await fetchHistory(tokA, gid);
  d = checkSystem(latestSystem(list), 'member_kicked');
  assert(d.actor.anonId === anonA && d.target.anonId === anonC, 'member_kicked actor=A target=C');
  assert(d.target.nick === nickC, `member_kicked target.nick=C 昵称 got ${d.target.nick}`);
  detail = await getDetail();
  assert(!detail.members.find((x) => x.anonId === anonC), '踢出后详情无 C');
  assert(detail.memberCount === before - 1, `memberCount-1（${before}->${detail.memberCount}）`);

  // 9. A 转交 B -> owner_transferred actor=A target=B + ownerAnonId=B + B=OWNER A=MEMBER
  const t1 = await call('POST', `/treehole/groups/${gid}/transfer`, tokA, { targetAnonId: anonB });
  assert(t1.body.code === 0 && t1.body.data.newOwner === anonB, `A 转交 B code=0 newOwner=B got ${JSON.stringify(t1.body)}`);
  list = await fetchHistory(tokA, gid);
  d = checkSystem(latestSystem(list), 'owner_transferred');
  assert(d.actor.anonId === anonA && d.target.anonId === anonB, 'owner_transferred actor=A target=B');
  detail = await getDetail();
  assert(detail.ownerAnonId === anonB, `ownerAnonId=B got ${detail.ownerAnonId}`);
  assert(roleOf(detail, anonB) === 'OWNER', `转交后 B=OWNER got ${roleOf(detail, anonB)}`);
  assert(roleOf(detail, anonA) === 'MEMBER', `转交后 A=MEMBER got ${roleOf(detail, anonA)}`);

  // 汇总：统计历史里全部系统消息，fromId 恒为 'system'，actor/target.anonId 均 anon_ 前缀
  const allSys = list.filter((m) => m.type === 'system');
  console.log('  历史系统消息总数 =', allSys.length);
  for (const m of allSys) {
    assert(m.fromId === 'system', `全局 fromId=system got ${m.fromId}`);
    const dd = JSON.parse(m.content);
    assertAnon(dd.actor, 'actor');
    if (dd.target) assertAnon(dd.target, 'target');
  }
  assert(allSys.length >= 9, `系统消息>=9 条 got ${allSys.length}`);

  console.log('\n[group-system-msg smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[group-system-msg smoke] STOPPED:', e.message);
  process.exit(1);
});
