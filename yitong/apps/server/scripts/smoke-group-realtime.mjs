/**
 * 群消息实时推送 + 撤回广播 smoke（feat/chat-group-realtime）
 *
 * 验证契约：
 *   1. sendGroupMessage 落库后由后端主动 broadcastToRoom('group:'+gid, {type:'room-msg', id, fromId, content, msgType, ts}, m.fromId)
 *      - B（在线群成员）WS 应收到 room-msg 帧，含 id（真实 DB id）、fromId=A 的 anonId、msgType='text'
 *      - A（发送方）WS 不收到自己发的消息（exclude = m.fromId）
 *   2. revokeMessage 落库后若 m.groupId 存在，broadcastToRoom('group:'+gid, {type:'room-revoke', messageId, ts}, operatorId)
 *      - B WS 应收到 room-revoke 帧，messageId = 之前 room-msg 的 id
 *      - A（操作方）WS 不收到自己撤回的广播（exclude = operatorId）
 *   3. 匿名红线：广播 payload 只含 anonId（fromId）+ content + id/messageId，不得含真实 uid（fromId 以 'anon_' 开头）
 *
 * 前置：docker postgres/redis 已起 + server 已起（npx nest start）+ mock 模式（WX/COS/TIM 走 mock）。
 * 用法：node apps/server/scripts/smoke-group-realtime.mjs
 *      可选环境变量：BASE_URL / WS_URL
 */
const BASE_HTTP = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE_HTTP}/auth/wx-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) {
      await sleep(14000);
      continue;
    }
    throw new Error(`login: ${JSON.stringify(j)}`);
  }
  throw new Error('login fail');
}

async function call(method, path, token, body) {
  const r = await fetch(`${BASE_HTTP}${path}`, {
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
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    process.exitCode = 1;
    throw new Error(msg);
  }
  console.log('  ✓', msg);
}

// 简易 WS 客户端：login 握手后收集所有帧
async function connectWs(cred, label) {
  const WebSocket = (await import('ws')).WebSocket;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const events = [];
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'login', loginUserId: cred.loginUserId, loginToken: cred.loginToken }));
    });
    ws.on('message', (data) => {
      try {
        events.push(JSON.parse(data.toString()));
      } catch {
        /* ignore */
      }
    });
    ws.on('error', (e) => reject(new Error(`${label} WS error: ${e.message}`)));
    ws.on('close', () => {});
    const waitLogin = setInterval(() => {
      if (events.find((e) => e.type === 'login_ok')) {
        clearInterval(waitLogin);
        resolve({ ws, events });
      }
      if (events.find((e) => e.type === 'login_failed')) {
        clearInterval(waitLogin);
        reject(new Error(`${label} WS login_failed`));
      }
    }, 50);
    setTimeout(() => {
      clearInterval(waitLogin);
      reject(new Error(`${label} WS login timeout`));
    }, 8000);
  });
}

// 轮询 events 直到出现满足 predicate 的帧
async function waitFor(events, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      const ev = events.find(predicate);
      if (ev) {
        clearInterval(t);
        resolve(ev);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        reject(new Error('WS wait timeout'));
      }
    }, 50);
  });
}

(async () => {
  console.log('[group-realtime smoke] base =', BASE_HTTP, 'WS =', WS_URL);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  // 1. 两个匿名号 A/B：WX 登录 + 换匿名身份
  const A = await login(`A${sfx}`, `Owner_${sfx}`);
  await sleep(14000); // 避开 wx-login 5/min 限流
  const B = await login(`B${sfx}`, `MemB_${sfx}`);
  await sleep(14000);

  const atA = await call('POST', '/treehole/anonymous-token', A.accessToken);
  const atB = await call('POST', '/treehole/anonymous-token', B.accessToken);
  assert(atA.body.code === 0, `A 匿名 token code=0 got ${JSON.stringify(atA.body)}`);
  assert(atB.body.code === 0, `B 匿名 token code=0 got ${JSON.stringify(atB.body)}`);
  const tokA = atA.body.data.anonToken;
  const tokB = atB.body.data.anonToken;
  const anonA = atA.body.data.anonId;
  const anonB = atB.body.data.anonId;
  // 匿名红线预备：anonId 形如 anon_xxx（不含真实 uid）
  assert(anonA.startsWith('anon_'), `A anonId anon_ 前缀 got ${anonA}`);
  assert(anonB.startsWith('anon_'), `B anonId anon_ 前缀 got ${anonB}`);
  console.log('  anonA=%s | anonB=%s', anonA, anonB);

  // 2. A 建群 -> B 加入
  const create = await call('POST', '/treehole/groups', tokA, { name: `RT群_${sfx}`, maxMembers: 10 });
  assert(create.body.code === 0, `A 建群 code=0 got ${JSON.stringify(create.body)}`);
  const gid = create.body.data.id;
  const joinB = await call('POST', `/treehole/groups/${gid}/join`, tokB);
  assert(joinB.body.code === 0, `B 加入群 code=0 got ${JSON.stringify(joinB.body)}`);

  // 3. A/B 各自拿 imCredential（getGroup 返回）
  const detailA = await call('GET', `/treehole/groups/${gid}`, tokA);
  const detailB = await call('GET', `/treehole/groups/${gid}`, tokB);
  assert(!!detailA.body.data?.imCredential, 'A getGroup 含 imCredential');
  assert(!!detailB.body.data?.imCredential, 'B getGroup 含 imCredential');

  // 4. A/B 各自 WS 连 ChatGateway + login + join room 'group:<id>'
  const aWs = await connectWs(detailA.body.data.imCredential, 'A');
  await waitFor(aWs.events, (e) => e.type === 'login_ok');
  assert(true, 'A WS login_ok');
  const bWs = await connectWs(detailB.body.data.imCredential, 'B');
  await waitFor(bWs.events, (e) => e.type === 'login_ok');
  assert(true, 'B WS login_ok');

  const roomId = `group:${gid}`;
  aWs.ws.send(JSON.stringify({ type: 'join', roomId }));
  await waitFor(aWs.events, (e) => e.type === 'joined' && e.roomId === roomId);
  assert(true, 'A joined group room');
  bWs.ws.send(JSON.stringify({ type: 'join', roomId }));
  await waitFor(bWs.events, (e) => e.type === 'joined' && e.roomId === roomId);
  assert(true, 'B joined group room');

  // 给 join 的 room_event 留点时间落盘（B join 时会广播 room_event 给 A）
  await sleep(200);

  // 5. A 通过 HTTP 发文字消息（后端 sendGroupMessage 主动广播，前端不双发）
  const text = `RT测试_${sfx}`;
  const sent = await call('POST', `/treehole/groups/${gid}/messages`, tokA, { content: text, type: 'text' });
  assert(sent.body.code === 0, `A 发群消息 HTTP 成功 got ${JSON.stringify(sent.body)}`);
  const dbId = sent.body.data.id;
  assert(typeof dbId === 'string' && dbId.length > 0, `HTTP 返回含真实 DB id got ${dbId}`);
  console.log('  A 发送消息 dbId=%s', dbId);

  // 6. 断言 B WS 收到 room-msg 帧
  const bRecv = await waitFor(bWs.events, (e) => e.type === 'room-msg' && e.roomId === roomId, 5000);
  console.log('  B 收到 room-msg:', JSON.stringify(bRecv));
  // 帧含 id（真实 DB id，= HTTP 返回的 id）
  assert(bRecv.id === dbId, `B room-msg.id = DB id got ${bRecv.id} expected ${dbId}`);
  // fromId = A 的 anonId（匿名红线：不含真实 uid）
  assert(bRecv.fromId === anonA, `B room-msg.fromId = A anonId got ${bRecv.fromId}`);
  assert(typeof bRecv.fromId === 'string' && bRecv.fromId.startsWith('anon_'), `room-msg.fromId anon_ 前缀 got ${bRecv.fromId}`);
  // content / msgType
  assert(bRecv.content === text, `B room-msg.content 正确 got ${bRecv.content}`);
  assert(bRecv.msgType === 'text', `B room-msg.msgType='text' got ${bRecv.msgType}`);
  // 匿名红线：payload 不得含真实 uid（只允许 type/roomId/id/fromId/content/msgType/ts 这些字段）
  const allowedKeys = new Set(['type', 'roomId', 'id', 'fromId', 'content', 'msgType', 'ts']);
  const extraKeys = Object.keys(bRecv).filter((k) => !allowedKeys.has(k));
  assert(extraKeys.length === 0, `room-msg payload 无多余字段（无真实 uid 泄露）got extra=${JSON.stringify(extraKeys)}`);

  // 7. 断言 A WS 不收到自己发的消息（exclude = m.fromId）
  await sleep(300); // 给广播一点时间确认 A 真的没收到
  const aSelfMsg = aWs.events.find((e) => e.type === 'room-msg' && e.roomId === roomId && e.id === dbId);
  assert(!aSelfMsg, 'A 不收到自己发的 room-msg（排除发送方）');

  // 8. A 通过 HTTP 撤回该消息
  const revoke = await call('POST', `/treehole/groups/${gid}/messages/${dbId}/revoke`, tokA);
  assert(revoke.body.code === 0, `A 撤回消息 HTTP 成功 got ${JSON.stringify(revoke.body)}`);
  assert(revoke.body.data.deleted === true, `撤回后 deleted=true`);

  // 9. 断言 B WS 收到 room-revoke 帧，messageId = 之前 room-msg 的 id
  const bRevoke = await waitFor(bWs.events, (e) => e.type === 'room-revoke' && e.roomId === roomId, 5000);
  console.log('  B 收到 room-revoke:', JSON.stringify(bRevoke));
  assert(bRevoke.messageId === dbId, `B room-revoke.messageId = DB id got ${bRevoke.messageId} expected ${dbId}`);
  // 匿名红线：revoke payload 只含 type/roomId/messageId/ts，无 fromId/uid
  const allowedRevokeKeys = new Set(['type', 'roomId', 'messageId', 'ts']);
  const extraRevokeKeys = Object.keys(bRevoke).filter((k) => !allowedRevokeKeys.has(k));
  assert(extraRevokeKeys.length === 0, `room-revoke payload 无多余字段（无 uid 泄露）got extra=${JSON.stringify(extraRevokeKeys)}`);

  // 10. 断言 A WS 不收到自己撤回的广播（exclude = operatorId）
  await sleep(300);
  const aSelfRevoke = aWs.events.find((e) => e.type === 'room-revoke' && e.roomId === roomId && e.messageId === dbId);
  assert(!aSelfRevoke, 'A 不收到自己撤回的 room-revoke（排除操作方）');

  // 11. 清理
  bWs.ws.close();
  aWs.ws.close();
  console.log('\n[group-realtime smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[group-realtime smoke] STOPPED:', e.message);
  process.exit(1);
});
