/**
 * P2-10 smoke：群成员管理（设角色/踢人/禁言）
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
  console.log('[P2-10 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Owner_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `Admin_${sfx}`);
  await sleep(14000);
  const C = await login(`C${sfx}`, `Member_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  const atC = await call('POST', '/treehole/anonymous-token', C.accessToken);
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken, tokC = atC.body.data.anonToken;
  const anonB = atB.body.data.anonId, anonC = atC.body.data.anonId;

  // 建群
  const create = await call('POST', '/treehole/groups', tokA, { name: `P2-10群_${sfx}`, maxMembers: 50 });
  const gid = create.body.data.id;

  // B/C 加入
  await call('POST', `/treehole/groups/${gid}/join`, tokB);
  await call('POST', `/treehole/groups/${gid}/join`, tokC);

  // 设 B 为 ADMIN
  const set1 = await call('POST', `/treehole/groups/${gid}/members/${anonB}/role`, tokA, { role: 'ADMIN' });
  assert(set1.body.code === 0 && set1.body.data.role === 'ADMIN', 'OWNER 设 B=ADMIN');

  // 详情：B 角色 ADMIN，C 角色 MEMBER
  const detail = await call('GET', `/treehole/groups/${gid}`, tokA);
  const bMem = detail.body.data.members.find((m) => m.anonId === anonB);
  const cMem = detail.body.data.members.find((m) => m.anonId === anonC);
  assert(bMem.role === 'ADMIN', 'B 角色 ADMIN');
  assert(cMem.role === 'MEMBER', 'C 角色 MEMBER');

  // MEMBER 设角色 10003
  const memSetRole = await call('POST', `/treehole/groups/${gid}/members/${anonC}/role`, tokC, { role: 'ADMIN' });
  assert(memSetRole.body.code === 10003, `MEMBER 设角色 10003 got ${memSetRole.body.code}`);

  // ADMIN 设角色 10003（仅 OWNER 可设角色）
  const adminSetRole = await call('POST', `/treehole/groups/${gid}/members/${anonC}/role`, tokB, { role: 'ADMIN' });
  assert(adminSetRole.body.code === 10003, `ADMIN 设角色 10003 got ${adminSetRole.body.code}`);

  // ADMIN 踢 C（成功）
  const kick1 = await call('POST', `/treehole/groups/${gid}/members/${anonC}/kick`, tokB);
  assert(kick1.body.code === 0, 'ADMIN 踢 MEMBER 成功');
  // C 重新加入
  await call('POST', `/treehole/groups/${gid}/join`, tokC);
  // 详情 memberCount 应回 3
  const d2 = await call('GET', `/treehole/groups/${gid}`, tokA);
  assert(d2.body.data.memberCount === 3, `memberCount=3 got ${d2.body.data.memberCount}`);

  // ADMIN 踢 ADMIN 被拒
  // 先看 C 现在 ADMIN 吗？不，C 是 MEMBER。设 C=ADMIN 让 adminSetRole 路径不通过 10003。
  // 直接测 ADMIN 踢 OWNER：应 30004
  const adminKickOwner = await call('POST', `/treehole/groups/${gid}/members/${atA.body.data.anonId}/kick`, tokB);
  assert(adminKickOwner.body.code === 30004, `ADMIN 踢 OWNER 30004 got ${adminKickOwner.body.code}`);

  // ADMIN 禁言 MEMBER（成功）
  const mute1 = await call('POST', `/treehole/groups/${gid}/members/${anonC}/mute`, tokB, { days: 7 });
  assert(mute1.body.code === 0, 'ADMIN 禁言 MEMBER 7天');
  assert(!!mute1.body.data.mutedUntil, '禁言含 mutedUntil');
  // 禁言天数无效 30004
  const muteBad = await call('POST', `/treehole/groups/${gid}/members/${anonC}/mute`, tokB, { days: 100 });
  assert(muteBad.body.code === 30004, `days=100 30004 got ${muteBad.body.code}`);

  // ADMIN 禁言 OWNER 30004
  const adminMuteOwner = await call('POST', `/treehole/groups/${gid}/members/${atA.body.data.anonId}/mute`, tokB, { days: 1 });
  assert(adminMuteOwner.body.code === 30004, `ADMIN 禁言 OWNER 30004 got ${adminMuteOwner.body.code}`);

  // MEMBER 禁言 10003
  // C 当前被禁言，但仍是 MEMBER，可调接口
  const memMute = await call('POST', `/treehole/groups/${gid}/members/${anonB}/mute`, tokC, { days: 1 });
  assert(memMute.body.code === 10003, `MEMBER 禁言 10003 got ${memMute.body.code}`);

  // 解除禁言（days=0）
  const unmute = await call('POST', `/treehole/groups/${gid}/members/${anonC}/mute`, tokA, { days: 0 });
  assert(unmute.body.code === 0 && unmute.body.data.mutedUntil === null, 'OWNER 解除禁言');

  // 详情：C.mutedUntil=null
  const d3 = await call('GET', `/treehole/groups/${gid}`, tokA);
  const cMem2 = d3.body.data.members.find((m) => m.anonId === anonC);
  assert(cMem2.mutedUntil === null, '解除后 mutedUntil=null');

  // 不能修改 OWNER 角色
  const setOwner = await call('POST', `/treehole/groups/${gid}/members/${atA.body.data.anonId}/role`, tokA, { role: 'MEMBER' });
  assert(setOwner.body.code === 30004, `改 OWNER 角色 30004 got ${setOwner.body.code}`);

  // 踢非成员 30009
  const D = await login(`D${sfx}`, `Outsider_${sfx}`);
  await sleep(14000);
  const kickOutsider = await call('POST', `/treehole/groups/${gid}/members/${D.accessToken ? 'cmx_o' : anonC}/kick`, tokA);
  // 注意：D 不是群成员但我们要踢的 anonId 是 D 的 anonId（不是 uid）
  // 简化：直接传一个不存在的 anonId
  const kickNoMember = await call('POST', `/treehole/groups/${gid}/members/cmx_nonexistent_anon/kick`, tokA);
  assert(kickNoMember.body.code === 30009, `踢非成员 30009 got ${kickNoMember.body.code}`);

  console.log('\n[P2-10 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-10 smoke] STOPPED:', e.message);
  process.exit(1);
});
