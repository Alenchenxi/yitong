/**
 * P1-15 smoke：规则匹配度计算
 * A/B 设不同标签 -> A 入队 -> B match 撮合 A -> 验证 matchScore（Jaccard）+ matchedTags
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
  console.log('[P1-15 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`ms-A-${sfx}-aaaa`, `MsA_${sfx}`);
  await sleep(14000);
  const B = await login(`ms-B-${sfx}-bbbb`, `MsB_${sfx}`);

  // A 设标签：interest=[音乐,电影], personality=[社恐]
  const updA = await call('PUT', `/treehole/profile`, A.accessToken, {
    interestTags: ['音乐', '电影'],
    personalityTags: ['社恐'],
  });
  assert(updA.body.code === 0, 'A 设标签');

  // B 设标签：interest=[音乐,阅读], personality=[话痨]
  const updB = await call('PUT', `/treehole/profile`, B.accessToken, {
    interestTags: ['音乐', '阅读'],
    personalityTags: ['话痨'],
  });
  assert(updB.body.code === 0, 'B 设标签');

  // A 换 anonToken + match（入队等待）
  const atA = await call('POST', `/treehole/anonymous-token`, A.accessToken);
  assert(atA.body.code === 0, 'A 换 anonToken');
  const mA = await call('POST', `/treehole/match`, atA.body.data.anonToken);
  assert(mA.body.code === 0 && mA.body.data.waiting === true, 'A match waiting（入队）');

  // B 换 anonToken + match（撮合 A）
  const atB = await call('POST', `/treehole/anonymous-token`, B.accessToken);
  assert(atB.body.code === 0, 'B 换 anonToken');
  const mB = await call('POST', `/treehole/match`, atB.body.data.anonToken);
  assert(mB.body.code === 0, 'B match');
  assert(mB.body.data.waiting === false, 'B 撮合成功');
  assert(mB.body.data.peerAnonId === atA.body.data.anonId, 'B 匹配到 A');

  // 匹配度：A tags=[音乐,电影,社恐]，B tags=[音乐,阅读,话痨]
  // 交集={音乐}，并集={音乐,电影,社恐,阅读,话痨}=5，score=1/5*100=20
  assert(mB.body.data.matchScore === 20, `matchScore=20 got ${mB.body.data.matchScore}`);
  assert(Array.isArray(mB.body.data.matchedTags) && mB.body.data.matchedTags.includes('音乐'), 'matchedTags 含「音乐」');
  assert(Array.isArray(mB.body.data.peerTags) && mB.body.data.peerTags.includes('电影'), 'peerTags 含 A 的「电影」');

  // A 再次 match -> 应拿到已有活跃匹配（带 matchScore）
  const mA2 = await call('POST', `/treehole/match`, atA.body.data.anonToken);
  assert(mA2.body.code === 0 && mA2.body.data.waiting === false, 'A 拿到已有活跃匹配');
  assert(mA2.body.data.matchScore === 20, `A matchScore=20 got ${mA2.body.data.matchScore}`);
  assert(mA2.body.data.matchedTags.includes('音乐'), 'A matchedTags 含「音乐」');

  // 全空标签匹配度=0 场景（另两个用户无标签）
  const C = await login(`ms-C-${sfx}-cccc`, `MsC_${sfx}`);
  await sleep(14000);
  const D = await login(`ms-D-${sfx}-dddd`, `MsD_${sfx}`);
  // C/D 不设标签（默认空）
  const atC = await call('POST', `/treehole/anonymous-token`, C.accessToken);
  await call('POST', `/treehole/match`, atC.body.data.anonToken); // C 入队
  const atD = await call('POST', `/treehole/anonymous-token`, D.accessToken);
  const mD = await call('POST', `/treehole/match`, atD.body.data.anonToken);
  assert(mD.body.code === 0 && mD.body.data.waiting === false, 'D 匹配 C（空标签）');
  assert(mD.body.data.matchScore === 0, `空标签 matchScore=0 got ${mD.body.data.matchScore}`);
  assert(Array.isArray(mD.body.data.matchedTags) && mD.body.data.matchedTags.length === 0, '空标签 matchedTags 为空');

  console.log('\n[P1-15 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-15 smoke] STOPPED:', e.message);
  process.exit(1);
});
