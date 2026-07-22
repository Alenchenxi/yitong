/**
 * P1-17 smoke：限时聊天（有效期 + 过期关闭）
 * 前置：server 以 TREEHOLE_MATCH_TTL_MS=3000 启动（3 秒有效期，便于测过期）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const TTL_MS = 3000; // 与 server 启动 env 一致
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
  console.log('[P1-17 smoke] base =', BASE, 'TTL =', TTL_MS, 'ms');
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `TcA_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `TcB_${sfx}`);

  const atA = await call('POST', `/treehole/anonymous-token`, A.accessToken);
  const atB = await call('POST', `/treehole/anonymous-token`, B.accessToken);

  // A 入队
  const mA = await call('POST', `/treehole/match`, atA.body.data.anonToken);
  assert(mA.body.data.waiting === true, 'A 入队 waiting');

  // B match 撮合 A -> expireAt 存在 + 接近 now+TTL
  const t0 = Date.now();
  const mB = await call('POST', `/treehole/match`, atB.body.data.anonToken);
  assert(mB.body.data.waiting === false, 'B 撮合 A');
  assert(!!mB.body.data.expireAt, 'match 返回 expireAt');
  const expireTs = new Date(mB.body.data.expireAt).getTime();
  const delta = expireTs - t0;
  assert(delta > TTL_MS - 1000 && delta < TTL_MS + 3000, `expireAt 在 now+TTL 附近 got delta=${delta}ms`);
  const matchId = mB.body.data.matchId;

  // listMatches 含 expireAt
  const hist = await call('GET', `/treehole/matches?page=1&pageSize=20`, atB.body.data.anonToken);
  assert(hist.body.code === 0, 'listMatches');
  const item = hist.body.data.list.find((x) => x.id === matchId);
  assert(item && !!item.expireAt, '历史含 expireAt');
  assert(item.status === 'ACTIVE', '历史 status ACTIVE');

  // A 拿活跃匹配（带 expireAt）
  const mA2 = await call('POST', `/treehole/match`, atA.body.data.anonToken);
  assert(mA2.body.data.waiting === false && !!mA2.body.data.expireAt, 'A 拿活跃匹配带 expireAt');

  // 等过期
  console.log('  ⏳ 等待过期...');
  await sleep(TTL_MS + 1500);

  // B 再 match -> 旧匹配过期关闭 -> 走队列 waiting
  const mB2 = await call('POST', `/treehole/match`, atB.body.data.anonToken);
  assert(mB2.body.data.waiting === true, 'B 过期后重新 match -> waiting（旧匹配已关闭）');

  // 旧匹配应 CLOSED
  const hist2 = await call('GET', `/treehole/matches?page=1&pageSize=20`, atB.body.data.anonToken);
  const item2 = hist2.body.data.list.find((x) => x.id === matchId);
  assert(item2 && item2.status === 'CLOSED', '旧匹配过期后 CLOSED');

  console.log('\n[P1-17 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-17 smoke] STOPPED:', e.message);
  process.exit(1);
});
