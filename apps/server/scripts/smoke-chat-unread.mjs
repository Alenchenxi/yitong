/**
 * 树洞 1v1 未读数 smoke（feat/chat-unread）。
 *
 * 覆盖：
 *   a. A HTTP 发消息后，B 会话 unread_count=1，A 会话 unread_count=0
 *   b. B WS 收到 msg + unread-update，A 不收到 unread-update
 *   c. B 调 read API 后 unread_count=0
 *   d. 不存在的会话调 read API 静默成功且不创建 ChatSession
 *
 * 前置：PostgreSQL/Redis/MinIO 已运行，Nest server 已启动：
 *   PORT=3400 CHAT_WS_PORT=3401 npx nest start
 * 用法：node apps/server/scripts/smoke-chat-unread.mjs
 * 可选：BASE_URL / WS_URL / CHAT_WS_PORT / DATABASE_URL。
 *
 * 任何 HTTP 429 / code=90001 会立即终止，不重试。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3400/api/v1';
const WS_URL = process.env.WS_URL || `ws://localhost:${process.env.CHAT_WS_PORT || '3401'}`;
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STEP_SLEEP_MS = 2500;

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

async function parseResponse(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label}: 非 JSON 响应 HTTP ${response.status}`);
  }
  if (response.status === 429 || body?.code === 90001) {
    const error = new Error(
      `${label}: API 429，立即停止；HTTP ${response.status} ${JSON.stringify(body)}`,
    );
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

async function connectWs(credential, label) {
  const { WebSocket } = await import('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const events = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(new Error(`${label} WS login timeout; events=${JSON.stringify(events)}`));
    }, 8000);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'login',
          loginUserId: credential.loginUserId,
          loginToken: credential.loginToken,
        }),
      );
    });
    ws.on('message', (raw) => {
      let event;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }
      events.push(event);
      if (!settled && event.type === 'login_ok') {
        settled = true;
        clearTimeout(timer);
        resolve({ ws, events });
      } else if (!settled && event.type === 'login_failed') {
        settled = true;
        clearTimeout(timer);
        ws.close();
        reject(new Error(`${label} WS login_failed: ${JSON.stringify(event)}`));
      }
    });
    ws.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${label} WS error: ${error.message}`));
    });
  });
}

async function waitFor(events, predicate, label, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const event = events.find(predicate);
    if (event) return event;
    await sleep(25);
  }
  throw new Error(`${label}: WS wait timeout; events=${JSON.stringify(events)}`);
}

async function main() {
  console.log(`[chat-unread smoke] HTTP=${BASE} WS=${WS_URL}`);
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const sockets = [];
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    const userA = await login(`unreadA_${suffix}`, `UnreadA_${suffix}`);
    await sleep(STEP_SLEEP_MS);
    const userB = await login(`unreadB_${suffix}`, `UnreadB_${suffix}`);
    await sleep(STEP_SLEEP_MS);

    const tokenRespA = await call('POST', '/treehole/anonymous-token', userA.accessToken);
    const tokenRespB = await call('POST', '/treehole/anonymous-token', userB.accessToken);
    assert(tokenRespA.body.code === 0, `A 匿名 token code=0 got=${tokenRespA.body.code}`);
    assert(tokenRespB.body.code === 0, `B 匿名 token code=0 got=${tokenRespB.body.code}`);

    const tokenA = tokenRespA.body.data.anonToken;
    const tokenB = tokenRespB.body.data.anonToken;
    const anonA = tokenRespA.body.data.anonId;
    const anonB = tokenRespB.body.data.anonId;
    assert(anonA.startsWith('anon_'), `anonA 使用匿名标识 got=${anonA}`);
    assert(anonB.startsWith('anon_'), `anonB 使用匿名标识 got=${anonB}`);
    console.log(`  anonA=${anonA} anonB=${anonB}`);

    await sleep(STEP_SLEEP_MS);
    const waitingA = await call('POST', '/treehole/match', tokenA);
    assert(waitingA.body.code === 0 && waitingA.body.data.waiting === true, 'A 首次匹配进入等待队列');
    await sleep(STEP_SLEEP_MS);
    const matchedB = await call('POST', '/treehole/match', tokenB);
    assert(
      matchedB.body.code === 0 && matchedB.body.data.waiting === false,
      `B 与 A 匹配成功 got=${JSON.stringify(matchedB.body)}`,
    );
    await sleep(STEP_SLEEP_MS);
    const matchedA = await call('POST', '/treehole/match', tokenA);
    assert(
      matchedA.body.code === 0 && matchedA.body.data.waiting === false,
      `A 读取活跃匹配成功 got=${JSON.stringify(matchedA.body)}`,
    );
    const matchId = matchedA.body.data.matchId;
    assert(matchId === matchedB.body.data.matchId, `A/B matchId 一致 got=${matchId}`);
    assert(matchedA.body.data.peerAnonId === anonB, 'A peerAnonId=anonB');
    assert(matchedB.body.data.peerAnonId === anonA, 'B peerAnonId=anonA');
    assert(!!matchedA.body.data.imCredential, 'A match 返回 imCredential');
    assert(!!matchedB.body.data.imCredential, 'B match 返回 imCredential');

    const wsA = await connectWs(matchedA.body.data.imCredential, 'A');
    sockets.push(wsA.ws);
    assert(wsA.events.some((event) => event.type === 'login_ok'), 'A WS login_ok');
    const wsB = await connectWs(matchedB.body.data.imCredential, 'B');
    sockets.push(wsB.ws);
    assert(wsB.events.some((event) => event.type === 'login_ok'), 'B WS login_ok');

    console.log('\n[a+b] 1v1 未读累计 + WS msg/unread-update');
    await sleep(STEP_SLEEP_MS);
    const content = `unread-${suffix}`;
    const sent = await call('POST', '/treehole/messages', tokenA, {
      peerAnonId: anonB,
      content,
      type: 'text',
    });
    assert(sent.body.code === 0, `A HTTP 发 1v1 消息 code=0 got=${JSON.stringify(sent.body)}`);
    const messageId = sent.body.data.id;

    const msgFrame = await waitFor(
      wsB.events,
      (event) => event.type === 'msg' && event.id === messageId,
      'B 等待 msg',
    );
    const unreadFrame = await waitFor(
      wsB.events,
      (event) => event.type === 'unread-update' && event.peerId === anonA,
      'B 等待 unread-update',
    );
    console.log(`  B msg frame=${JSON.stringify(msgFrame)}`);
    console.log(`  B unread-update frame=${JSON.stringify(unreadFrame)}`);
    assert(msgFrame.fromId === anonA, `msg.fromId=anonA got=${msgFrame.fromId}`);
    assert(msgFrame.content === content, `msg.content 正确 got=${msgFrame.content}`);
    assert(unreadFrame.peerId === anonA, `unread-update.peerId=anonA got=${unreadFrame.peerId}`);
    assert(unreadFrame.unreadCount === 1, `unread-update.unreadCount=1 got=${unreadFrame.unreadCount}`);
    assert(Number.isFinite(unreadFrame.ts), `unread-update.ts 有效 got=${unreadFrame.ts}`);
    await sleep(300);
    assert(
      !wsA.events.some((event) => event.type === 'unread-update'),
      `A 不收到 unread-update events=${JSON.stringify(wsA.events)}`,
    );

    const receiverSession = await prisma.chatSession.findUnique({
      where: { ownerId_peerId: { ownerId: anonB, peerId: anonA } },
    });
    const senderSession = await prisma.chatSession.findUnique({
      where: { ownerId_peerId: { ownerId: anonA, peerId: anonB } },
    });
    console.log(
      `  DB receiver(owner=${anonB},peer=${anonA}) unread_count=${receiverSession?.unreadCount}`,
    );
    console.log(`  DB sender(owner=${anonA},peer=${anonB}) unread_count=${senderSession?.unreadCount}`);
    assert(receiverSession?.unreadCount === 1, `接收方 DB unread_count=1 got=${receiverSession?.unreadCount}`);
    assert(senderSession?.unreadCount === 0, `发送方 DB unread_count=0 got=${senderSession?.unreadCount}`);

    console.log('\n[c] reset unread_count=0');
    await sleep(STEP_SLEEP_MS);
    const reset = await call('POST', `/treehole/chats/${anonA}/read`, tokenB);
    assert(reset.body.code === 0, `B reset code=0 got=${JSON.stringify(reset.body)}`);
    const resetSession = await prisma.chatSession.findUnique({
      where: { ownerId_peerId: { ownerId: anonB, peerId: anonA } },
    });
    console.log(`  DB reset(owner=${anonB},peer=${anonA}) unread_count=${resetSession?.unreadCount}`);
    assert(resetSession?.unreadCount === 0, `reset 后 DB unread_count=0 got=${resetSession?.unreadCount}`);

    console.log('\n[d] reset 不存在会话静默成功');
    const missingPeer = `anon_missing_${suffix}`;
    const beforeMissing = await prisma.chatSession.count({
      where: { ownerId: anonB, peerId: missingPeer },
    });
    assert(beforeMissing === 0, `reset 前不存在会话 rowCount=0 got=${beforeMissing}`);
    await sleep(STEP_SLEEP_MS);
    const resetMissing = await call('POST', `/treehole/chats/${missingPeer}/read`, tokenB);
    assert(resetMissing.body.code === 0, `不存在会话 reset code=0 got=${JSON.stringify(resetMissing.body)}`);
    const afterMissing = await prisma.chatSession.count({
      where: { ownerId: anonB, peerId: missingPeer },
    });
    console.log(`  DB missing(owner=${anonB},peer=${missingPeer}) rowCount=${afterMissing}`);
    assert(afterMissing === 0, `reset 后仍不创建会话 rowCount=0 got=${afterMissing}`);

    console.log('\n[chat-unread smoke] ALL PASSED (a/b/c/d)');
  } finally {
    for (const ws of sockets) ws.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error?.code === 'API_429') {
    console.error(`\n[chat-unread smoke] API 429 STOPPED: ${error.message}`);
  } else {
    console.error(`\n[chat-unread smoke] FAILED: ${error.stack || error.message}`);
  }
  process.exit(1);
});
