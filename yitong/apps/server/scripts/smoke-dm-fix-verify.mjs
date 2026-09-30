/**
 * 树洞 1v1 撤回修复验证：精确错误码 + DB 防误删。
 *
 * 场景：
 *   a) A 撤回 A 自己的消息（正例 code=0 + deleted=true）；B 撤回 A 的消息（负例 code=10003 + DB 防误删）。
 *   d) A 用错的 chatId（M2）撤 A 的消息（负例 code=30010 + DB 防误删）；
 *      A 用正确的 chatId（M1）撤回（正例 code=0 + deleted=true）。
 *
 * 限流友好：开头 sleep 3 秒；不同 anon 号之间 sleep 2 秒；每个断言之间 sleep 1.5 秒。
 *
 * 用法：node apps/server/scripts/smoke-dm-fix-verify.mjs
 * 可选：BASE_URL / DATABASE_URL。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3200/api/v1';
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
  console.log(`  PASS  ${message}`);
}

async function parseResponse(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label}: 非 JSON 响应 HTTP ${response.status}`);
  }
  if (response.status === 429 || body?.code === 90001) {
    const error = new Error(`${label}: API 429，立即停止；HTTP ${response.status} ${JSON.stringify(body)}`);
    error.code = 'API_429';
    throw error;
  }
  return { status: response.status, body };
}

async function call(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response, `${method} ${path}`);
}

async function login(code, nickname) {
  const response = await fetch(`${BASE}/auth/wx-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, role: 'user', nickname }),
  });
  const result = await parseResponse(response, 'POST /auth/wx-login');
  if (result.body.code !== 0) {
    throw new Error(`登录失败: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.data;
}

async function getAnonToken(accessToken) {
  const result = await call('POST', '/treehole/anonymous-token', accessToken);
  if (result.body.code !== 0) {
    throw new Error(`匿名 token 获取失败: ${JSON.stringify(result.body)}`);
  }
  return result.body.data;
}

async function ensureMatched(tokenA, tokenB) {
  const waitingA = await call('POST', '/treehole/match', tokenA);
  assert(waitingA.body.code === 0, `A 首次匹配等待 code=0 got=${waitingA.body.code}`);
  const matchedB = await call('POST', '/treehole/match', tokenB);
  assert(matchedB.body.code === 0, `B 匹配成功 code=0 got=${matchedB.body.code}`);
  const matchedA = await call('POST', '/treehole/match', tokenA);
  assert(matchedA.body.code === 0, `A 读取匹配 code=0 got=${matchedA.body.code}`);
  return matchedA.body.data;
}

async function main() {
  console.log(`[dm-fix-verify] HTTP=${BASE}`);
  console.log('sleep 3s 让限流冷却...');
  await sleep(3000);

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    // ===== 准备 4 个用户 + 4 个匿名身份 =====
    const userA = await login(`fixA_${suffix}`, `FixA_${suffix}`);
    await sleep(2000);
    const userB = await login(`fixB_${suffix}`, `FixB_${suffix}`);
    await sleep(2000);
    const userC = await login(`fixC_${suffix}`, `FixC_${suffix}`);
    await sleep(2000);
    const userD = await login(`fixD_${suffix}`, `FixD_${suffix}`);

    const anonA = await getAnonToken(userA.accessToken);
    await sleep(2000);
    const anonB = await getAnonToken(userB.accessToken);
    await sleep(2000);
    const anonC = await getAnonToken(userC.accessToken);
    await sleep(2000);
    const anonD = await getAnonToken(userD.accessToken);
    assert(anonA.anonId.startsWith('anon_'), `anonA 匿名标识 got=${anonA.anonId}`);
    assert(anonB.anonId.startsWith('anon_'), `anonB 匿名标识 got=${anonB.anonId}`);
    assert(anonC.anonId.startsWith('anon_'), `anonC 匿名标识 got=${anonC.anonId}`);
    assert(anonD.anonId.startsWith('anon_'), `anonD 匿名标识 got=${anonD.anonId}`);

    // ===== M1: A<->B =====
    console.log('\n[setup] 创建匹配 M1 (A<->B)');
    const match1 = await ensureMatched(anonA.anonToken, anonB.anonToken);
    const matchId1 = match1.matchId;
    const matchId1FromB = await call('POST', '/treehole/match', anonB.anonToken);
    assert(matchId1FromB.body.data.matchId === matchId1, `B 读取 M1 matchId 一致 got=${matchId1FromB.body.data.matchId}`);
    await sleep(1500);

    // ===== M2: C<->D =====
    console.log('\n[setup] 创建匹配 M2 (C<->D)');
    const match2 = await ensureMatched(anonC.anonToken, anonD.anonToken);
    const matchId2 = match2.matchId;
    assert(matchId2 !== matchId1, `M1 != M2 matchId`);
    await sleep(1500);

    // ===== A 发一条 1v1 消息 =====
    console.log('\n[setup] A 在 M1 中发一条消息给 B');
    const sent = await call('POST', '/treehole/messages', anonA.anonToken, {
      peerAnonId: anonB.anonId,
      content: `dm-fix-${suffix}`,
      type: 'text',
    });
    assert(sent.body.code === 0, `A 发消息 code=0 got=${JSON.stringify(sent.body)}`);
    const msgId = sent.body.data.id;
    assert(typeof msgId === 'string' && msgId.length > 0, `取得 msgId=${msgId}`);
    await sleep(1500);

    // 记录发送时原始 content（用于校验防误删）
    const originalContent = `dm-fix-${suffix}`;

    // ============================
    // 场景 a 负例：B 撤回 A 的消息 → 期望 10003 + DB 防误删
    // ============================
    console.log('\n[场景 a 负例] B 尝试撤回 A 的消息');
    const wrongOp = await call(
      'POST',
      `/treehole/chats/${matchId1}/messages/${msgId}/revoke`,
      anonB.anonToken,
    );
    assert(
      wrongOp.body.code === 10003,
      `B 撤回 A 消息 code=10003 got=${JSON.stringify(wrongOp.body)}`,
    );
    assert(
      String(wrongOp.body.message || '').includes('只能撤回自己的消息'),
      `B 撤回 A 消息 message 描述 got=${wrongOp.body.message}`,
    );
    await sleep(1500);

    // DB 防误删：deletedAt=null, content=原文
    const afterWrong = await prisma.chatMessage.findUnique({ where: { id: msgId } });
    assert(!!afterWrong, `DB 仍可查到 msgId=${msgId}`);
    assert(afterWrong.deletedAt === null, `B 撤失败后 DB deletedAt=null got=${afterWrong.deletedAt}`);
    assert(
      afterWrong.content === originalContent,
      `B 撤失败后 DB content 原文未改 got=${afterWrong.content}`,
    );
    console.log('  PASS  DB 防误删：B 撤回失败后消息未被修改');

    // ============================
    // 场景 d 负例：A 用错的 chatId（M2）撤回 → 期望 30010 + DB 防误删
    // ============================
    console.log('\n[场景 d 负例] A 用错的 chatId=M2 撤 M1 的消息');
    const wrongChat = await call(
      'POST',
      `/treehole/chats/${matchId2}/messages/${msgId}/revoke`,
      anonA.anonToken,
    );
    assert(
      wrongChat.body.code === 30010,
      `chatId 错配 code=30010 got=${JSON.stringify(wrongChat.body)}`,
    );
    assert(
      String(wrongChat.body.message || '').includes('消息不属于该匹配'),
      `chatId 错配 message 描述 got=${wrongChat.body.message}`,
    );
    await sleep(1500);

    const afterWrongChat = await prisma.chatMessage.findUnique({ where: { id: msgId } });
    assert(afterWrongChat.deletedAt === null, `chatId 错配后 DB deletedAt=null got=${afterWrongChat.deletedAt}`);
    assert(
      afterWrongChat.content === originalContent,
      `chatId 错配后 DB content 原文未改 got=${afterWrongChat.content}`,
    );
    console.log('  PASS  DB 防误删：chatId 错配时消息未被修改');

    // ============================
    // 场景 a/d 正例：A 用正确的 chatId（M1）撤回自己的消息 → 期望 code=0 + deleted=true
    // ============================
    console.log('\n[场景 a/d 正例] A 用正确 chatId=M1 撤回自己的消息');
    const selfRevoke = await call(
      'POST',
      `/treehole/chats/${matchId1}/messages/${msgId}/revoke`,
      anonA.anonToken,
    );
    assert(
      selfRevoke.body.code === 0,
      `A 撤回自己消息 code=0 got=${JSON.stringify(selfRevoke.body)}`,
    );
    assert(selfRevoke.body.data.deleted === true, `A 撤回 deleted=true got=${selfRevoke.body.data.deleted}`);
    assert(selfRevoke.body.data.content === '[已撤回]', `A 撤回 content=[已撤回] got=${selfRevoke.body.data.content}`);
    await sleep(1500);

    const afterSelf = await prisma.chatMessage.findUnique({ where: { id: msgId } });
    assert(afterSelf.deletedAt instanceof Date, `A 撤回后 DB deletedAt 非空 got=${afterSelf.deletedAt}`);
    assert(afterSelf.content === '[已撤回]', `A 撤回后 DB content=[已撤回] got=${afterSelf.content}`);
    console.log('  PASS  A 撤回成功，DB 已撤回');

    console.log('\n[dm-fix-verify] ALL PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error?.code === 'API_429') {
    console.error(`\n[dm-fix-verify] API 429 STOPPED: ${error.message}`);
  } else {
    console.error(`\n[dm-fix-verify] FAILED: ${error.stack || error.message}`);
  }
  process.exit(1);
});