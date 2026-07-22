/**
 * P2-11 smoke：群聊消息（文字/历史/撤回/禁言）
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
  console.log('[P2-11 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `MemA_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `OwnerB_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  const tokA = atA.body.data.anonToken, tokB = atB.body.data.anonToken;
  const anonA = atA.body.data.anonId;

  // B 建群（B=OWNER），A 加入（A=MEMBER，可被禁言）
  const create = await call('POST', '/treehole/groups', tokB, { name: `P2-11群_${sfx}`, maxMembers: 20 });
  const gid = create.body.data.id;
  await call('POST', `/treehole/groups/${gid}/join`, tokA);

  // A 发消息
  const m1 = await call('POST', `/treehole/groups/${gid}/messages`, tokA, { content: 'A 的第一条', type: 'text' });
  assert(m1.body.code === 0, 'A 发消息成功');
  assert(m1.body.data.groupId === gid, 'groupId 正确');
  assert(m1.body.data.toId === null, '群消息 toId=null');
  assert(m1.body.data.fromId === anonA, 'fromId=发送者');

  // B 发消息
  const m2 = await call('POST', `/treehole/groups/${gid}/messages`, tokB, { content: 'B 的回复', type: 'text' });
  assert(m2.body.code === 0, 'B 发消息成功');

  // 群消息列表（升序：m1 老，m2 新）
  const list = await call('GET', `/treehole/groups/${gid}/messages?limit=50`, tokA);
  assert(list.body.code === 0, '群消息列表');
  assert(list.body.data.list.length === 2, `列表含 2 条 got ${list.body.data.list.length}`);
  assert(list.body.data.list[0].content === 'A 的第一条', '第 1 条 A');
  assert(list.body.data.list[1].content === 'B 的回复', '第 2 条 B');

  // 空消息 30004
  const empty = await call('POST', `/treehole/groups/${gid}/messages`, tokA, { content: '   ' });
  assert(empty.body.code === 30004, `空消息 30004 got ${empty.body.code}`);

  // 非群成员 10003
  const C = await login(`C${sfx}`, `Outsider_${sfx}`);
  await sleep(14000);
  const atC = await call('POST', '/treehole/anonymous-token', C.accessToken);
  const out = await call('POST', `/treehole/groups/${gid}/messages`, atC.body.data.anonToken, { content: 'x' });
  assert(out.body.code === 10003, `非成员 10003 got ${out.body.code}`);

  // A 撤回 m1
  const revoke = await call('POST', `/treehole/groups/${gid}/messages/${m1.body.data.id}/revoke`, tokA);
  assert(revoke.body.code === 0, 'A 撤回自己的消息');
  assert(revoke.body.data.deleted === true, '撤回后 deleted=true');
  assert(revoke.body.data.content === '[已撤回]', 'content 替换为占位');

  // B 撤回 A 的消息（不能）10003
  const otherRevoke = await call('POST', `/treehole/groups/${gid}/messages/${m1.body.data.id}/revoke`, tokB);
  assert(otherRevoke.body.code === 10003, `他人撤回 10003 got ${otherRevoke.body.code}`);

  // 不存在消息 30010
  const noMsg = await call('POST', `/treehole/groups/${gid}/messages/cmx_no/revoke`, tokB);
  assert(noMsg.body.code === 30010, `不存在 30010 got ${noMsg.body.code}`);

  // 禁言：B（OWNER）禁言 A（MEMBER），A 发消息 30011
  const mute = await call('POST', `/treehole/groups/${gid}/members/${anonA}/mute`, tokB, { days: 1 });
  assert(mute.body.code === 0, 'B 禁言 A 成功');
  const muted = await call('POST', `/treehole/groups/${gid}/messages`, tokA, { content: 'x' });
  assert(muted.body.code === 30011, `禁言拦截 30011 got ${muted.body.code}`);

  // 解除禁言
  await call('POST', `/treehole/groups/${gid}/members/${anonA}/mute`, tokB, { days: 0 });
  const ok = await call('POST', `/treehole/groups/${gid}/messages`, tokA, { content: '解禁后能发' });
  assert(ok.body.code === 0, '解除禁言后发送成功');

  console.log('\n[P2-11 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-11 smoke] STOPPED:', e.message);
  process.exit(1);
});
