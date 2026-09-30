/**
 * P1-16 smoke：匹配历史 / 重新匹配 / 跳过
 * A/B/C 三用户：A-B 匹配 -> B 跳过 A -> B 重新匹配 C -> A 查历史见 A-B(CLOSED) + B 查历史
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
  console.log('[P1-16 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  // mock openid = mock_${code.slice(0,8)}；code 首字符用 A/B/C 区分用户，sfx 保证跨次唯一
  const A = await login(`A${sfx}`, `MhA_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `MhB_${sfx}`);
  await sleep(14000);
  const C = await login(`C${sfx}`, `MhC_${sfx}`);

  // 三人换 anonToken
  const atA = await call('POST', `/treehole/anonymous-token`, A.accessToken);
  const atB = await call('POST', `/treehole/anonymous-token`, B.accessToken);
  const atC = await call('POST', `/treehole/anonymous-token`, C.accessToken);
  const anonA = atA.body.data.anonId;
  const anonB = atB.body.data.anonId;
  const anonC = atC.body.data.anonId;

  // A 先入队
  const mA = await call('POST', `/treehole/match`, atA.body.data.anonToken);
  assert(mA.body.data.waiting === true, 'A 入队 waiting');

  // B match -> 撮合 A
  const mB = await call('POST', `/treehole/match`, atB.body.data.anonToken);
  assert(mB.body.data.waiting === false, 'B 匹配 A');
  const matchIdAB = mB.body.data.matchId;
  assert(matchIdAB, 'B 拿到 matchId');
  assert(mB.body.data.peerAnonId === anonA, 'B 的 peer 是 A');

  // C 入队
  const mC = await call('POST', `/treehole/match`, atC.body.data.anonToken);
  assert(mC.body.data.waiting === true, 'C 入队 waiting');

  // 1) B 查匹配历史 -> 应见 A-B（ACTIVE）
  const histB1 = await call('GET', `/treehole/matches?page=1&pageSize=20`, atB.body.data.anonToken);
  assert(histB1.body.code === 0, 'B 历史列表');
  assert(histB1.body.data.list.length >= 1, 'B 历史至少 1 条');
  const abItem = histB1.body.data.list.find((x) => x.id === matchIdAB);
  assert(abItem, 'B 历史含 A-B 匹配');
  assert(abItem.status === 'ACTIVE', 'A-B 状态 ACTIVE');
  assert(abItem.peerAnonId === anonA, 'B 历史 peerAnonId=A');
  assert(typeof abItem.peerNickname === 'string', '历史含 peerNickname');

  // 2) B 跳过 A -> 关闭 A-B + 重新匹配 -> 应撮合 C
  const skip = await call('POST', `/treehole/matches/${matchIdAB}/skip`, atB.body.data.anonToken);
  assert(skip.body.code === 0, 'B skip A-B');
  // skip 返回新匹配结果（应匹配到 C，因为 C 在队列）
  // 注意：skip 内部调 match，C 在队列 -> 撮合 C
  if (!skip.body.data.waiting) {
    assert(skip.body.data.peerAnonId === anonC, `B skip 后匹配 C got ${skip.body.data.peerAnonId}`);
  } else {
    // C 可能已被自己 removeFromMatchQueue（match 时 remove），但 C waiting 时仍在队列
    // 如果 skip 后 waiting，说明 C 不在队列了，再 match 一次
    const mB2 = await call('POST', `/treehole/match`, atB.body.data.anonToken);
    if (!mB2.body.data.waiting) {
      assert(mB2.body.data.peerAnonId === anonC, 'B 重新 match 匹配 C');
    }
  }

  // 3) A-B 匹配应已 CLOSED
  const histB2 = await call('GET', `/treehole/matches?page=1&pageSize=20`, atB.body.data.anonToken);
  const abItem2 = histB2.body.data.list.find((x) => x.id === matchIdAB);
  assert(abItem2 && abItem2.status === 'CLOSED', 'A-B skip 后 CLOSED');

  // 4) A 查历史 -> A-B CLOSED
  const histA = await call('GET', `/treehole/matches?page=1&pageSize=20`, atA.body.data.anonToken);
  const abItemA = histA.body.data.list.find((x) => x.id === matchIdAB);
  assert(abItemA && abItemA.status === 'CLOSED', 'A 历史见 A-B CLOSED');

  // 5) 无权跳过他人匹配 -> 10003
  const badSkip = await call('POST', `/treehole/matches/${matchIdAB}/skip`, atC.body.data.anonToken);
  assert(badSkip.body.code === 10003, `C skip A-B 拒绝 10003 got ${badSkip.body.code}`);

  // 6) 跳过不存在匹配 -> 30010
  const noExist = await call('POST', `/treehole/matches/nonexist/skip`, atA.body.data.anonToken);
  assert(noExist.body.code === 30010, `不存在匹配 30010 got ${noExist.body.code}`);

  console.log('\n[P1-16 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-16 smoke] STOPPED:', e.message);
  process.exit(1);
});
