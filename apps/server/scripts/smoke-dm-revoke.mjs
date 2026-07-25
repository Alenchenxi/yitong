/**
 * 树洞 1v1 撤回 + 实时同步 + 群撤回回归 smoke。
 *
 * 前置：PostgreSQL/Redis/MinIO 已运行，Nest server 已通过 `npx nest start` 启动。
 * 用法：node apps/server/scripts/smoke-dm-revoke.mjs
 * 可选：BASE_URL / WS_URL / CHAT_WS_PORT / DATABASE_URL。
 *
 * 任何 HTTP 429 / code=90001 会立即终止，不重试。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const WS_URL = process.env.WS_URL || `ws://localhost:${process.env.CHAT_WS_PORT || '3001'}`;
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      reject(new Error(`${label} WS login timeout`));
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
  console.log(`[dm-revoke smoke] HTTP=${BASE} WS=${WS_URL}`);
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const sockets = [];
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    const userA = await login(`dmA_${suffix}`, `DmA_${suffix}`);
    const userB = await login(`dmB_${suffix}`, `DmB_${suffix}`);
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

    const waitingA = await call('POST', '/treehole/match', tokenA);
    assert(waitingA.body.code === 0 && waitingA.body.data.waiting === true, 'A 首次匹配进入等待队列');
    const matchedB = await call('POST', '/treehole/match', tokenB);
    assert(
      matchedB.body.code === 0 && matchedB.body.data.waiting === false,
      'B 与 A 匹配成功',
    );
    const matchedA = await call('POST', '/treehole/match', tokenA);
    assert(
      matchedA.body.code === 0 && matchedA.body.data.waiting === false,
      'A 读取活跃匹配成功',
    );
    const matchId = matchedA.body.data.matchId;
    assert(matchId === matchedB.body.data.matchId, `A/B matchId 一致 got=${matchId}`);
    assert(matchedA.body.data.peerAnonId === anonB, 'A peerAnonId=anonB');
    assert(matchedB.body.data.peerAnonId === anonA, 'B peerAnonId=anonA');
    assert(!!matchedA.body.data.imCredential, 'A 匹配结果含 IM 凭证');
    assert(!!matchedB.body.data.imCredential, 'B 匹配结果含 IM 凭证');

    console.log('\n[a] 1v1 撤回 API 基本行为');
    const sentA = await call('POST', '/treehole/messages', tokenA, {
      peerAnonId: anonB,
      content: `dm-basic-${suffix}`,
      type: 'text',
    });
    assert(sentA.body.code === 0, `A HTTP 发 1v1 消息 code=0 got=${JSON.stringify(sentA.body)}`);
    const basicMessageId = sentA.body.data.id;
    assert(typeof basicMessageId === 'string' && basicMessageId.length > 0, `取得 msgId=${basicMessageId}`);

    const revokedA = await call(
      'POST',
      `/treehole/chats/${matchId}/messages/${basicMessageId}/revoke`,
      tokenA,
    );
    assert(revokedA.body.code === 0, `A 撤回 code=0 got=${JSON.stringify(revokedA.body)}`);
    assert(revokedA.body.data.deleted === true, 'A 撤回返回 deleted=true');
    assert(revokedA.body.data.content === '[已撤回]', 'A 撤回返回 content=[已撤回]');

    const wrongOperator = await call(
      'POST',
      `/treehole/chats/${matchId}/messages/${basicMessageId}/revoke`,
      tokenB,
    );
    assert(
      wrongOperator.body.code === 10003,
      `B 撤回 A 消息返回 10003 got=${wrongOperator.status}/${JSON.stringify(wrongOperator.body)}`,
    );

    const basicRow = await prisma.chatMessage.findUnique({ where: { id: basicMessageId } });
    assert(!!basicRow, `DB 可查消息 id=${basicMessageId}`);
    assert(basicRow.deletedAt instanceof Date, `DB deletedAt 非空 got=${basicRow.deletedAt}`);
    assert(basicRow.content === '[已撤回]', `DB content=[已撤回] got=${basicRow.content}`);

    console.log('\n[b] 1v1 消息与撤回实时同步');
    const wsA = await connectWs(matchedA.body.data.imCredential, 'A');
    sockets.push(wsA.ws);
    assert(wsA.events.some((event) => event.type === 'login_ok'), 'A WS login_ok');
    const wsB = await connectWs(matchedB.body.data.imCredential, 'B');
    sockets.push(wsB.ws);
    assert(wsB.events.some((event) => event.type === 'login_ok'), 'B WS login_ok');

    const realtimeContent = `dm-realtime-${suffix}`;
    const realtimeSent = await call('POST', '/treehole/messages', tokenA, {
      peerAnonId: anonB,
      content: realtimeContent,
      type: 'text',
    });
    assert(
      realtimeSent.body.code === 0,
      `A HTTP 发实时 1v1 消息 code=0 got=${JSON.stringify(realtimeSent.body)}`,
    );
    const realtimeMessageId = realtimeSent.body.data.id;
    const bMessage = await waitFor(
      wsB.events,
      (event) => event.type === 'msg' && event.id === realtimeMessageId,
      'B 等待 msg',
    );
    console.log(`  B msg frame=${JSON.stringify(bMessage)}`);
    assert(bMessage.fromId === anonA, `B msg.fromId=anonA got=${bMessage.fromId}`);
    assert(bMessage.content === realtimeContent, `B msg.content 正确 got=${bMessage.content}`);
    assert(bMessage.msgType === 'text', `B msg.msgType=text got=${bMessage.msgType}`);
    assert(bMessage.id === realtimeMessageId, `B msg.id=HTTP id got=${bMessage.id}`);

    const realtimeRevoked = await call(
      'POST',
      `/treehole/chats/${matchId}/messages/${realtimeMessageId}/revoke`,
      tokenA,
    );
    assert(realtimeRevoked.body.code === 0, 'A HTTP 撤回实时消息 code=0');
    const bRevoke = await waitFor(
      wsB.events,
      (event) => event.type === 'msg-revoke' && event.messageId === realtimeMessageId,
      'B 等待 msg-revoke',
    );
    console.log(`  B msg-revoke frame=${JSON.stringify(bRevoke)}`);
    assert(bRevoke.fromId === anonA, `B msg-revoke.fromId=anonA got=${bRevoke.fromId}`);
    assert(
      bRevoke.messageId === realtimeMessageId,
      `B msg-revoke.messageId=刚撤回 id got=${bRevoke.messageId}`,
    );
    await sleep(300);
    const aSelfRevoke = wsA.events.find(
      (event) => event.type === 'msg-revoke' && event.messageId === realtimeMessageId,
    );
    assert(!aSelfRevoke, 'A WS 不收到自己撤回的 msg-revoke');

    console.log('\n[c] 群消息撤回实时广播回归');
    const createdGroup = await call('POST', '/treehole/groups', tokenA, {
      name: `DM撤回回归_${suffix}`,
      maxMembers: 10,
    });
    assert(
      createdGroup.body.code === 0,
      `A 建群 code=0 got=${JSON.stringify(createdGroup.body)}`,
    );
    const groupId = createdGroup.body.data.id;
    const joinedB = await call('POST', `/treehole/groups/${groupId}/join`, tokenB);
    assert(joinedB.body.code === 0, `B 加群 code=0 got=${JSON.stringify(joinedB.body)}`);

    const roomId = `group:${groupId}`;
    wsA.ws.send(JSON.stringify({ type: 'join', roomId }));
    await waitFor(wsA.events, (event) => event.type === 'joined' && event.roomId === roomId, 'A 加入群 WS room');
    assert(true, 'A joined group room');
    wsB.ws.send(JSON.stringify({ type: 'join', roomId }));
    await waitFor(wsB.events, (event) => event.type === 'joined' && event.roomId === roomId, 'B 加入群 WS room');
    assert(true, 'B joined group room');

    const groupContent = `group-revoke-${suffix}`;
    const groupSent = await call('POST', `/treehole/groups/${groupId}/messages`, tokenA, {
      content: groupContent,
      type: 'text',
    });
    assert(groupSent.body.code === 0, `A 发群消息 code=0 got=${JSON.stringify(groupSent.body)}`);
    const groupMessageId = groupSent.body.data.id;
    const bRoomMessage = await waitFor(
      wsB.events,
      (event) => event.type === 'room-msg' && event.roomId === roomId && event.id === groupMessageId,
      'B 等待 room-msg',
    );
    assert(bRoomMessage.content === groupContent, `B 收到 room-msg got=${JSON.stringify(bRoomMessage)}`);

    const groupRevoked = await call(
      'POST',
      `/treehole/groups/${groupId}/messages/${groupMessageId}/revoke`,
      tokenA,
    );
    assert(groupRevoked.body.code === 0, 'A 撤回群消息 code=0');
    assert(groupRevoked.body.data.deleted === true, '群撤回返回 deleted=true');
    const bRoomRevoke = await waitFor(
      wsB.events,
      (event) =>
        event.type === 'room-revoke' &&
        event.roomId === roomId &&
        event.messageId === groupMessageId,
      'B 等待 room-revoke',
    );
    console.log(`  B room-revoke frame=${JSON.stringify(bRoomRevoke)}`);
    assert(bRoomRevoke.messageId === groupMessageId, 'B room-revoke.messageId=群消息 id');

    console.log('\n[dm-revoke smoke] ALL PASSED');
  } finally {
    for (const ws of sockets) ws.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error?.code === 'API_429') {
    console.error(`\n[dm-revoke smoke] API 429 STOPPED: ${error.message}`);
  } else {
    console.error(`\n[dm-revoke smoke] FAILED: ${error.stack || error.message}`);
  }
  process.exit(1);
});
