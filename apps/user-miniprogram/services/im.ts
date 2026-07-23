// IM manager: wx.connectSocket -> ChatGateway with login handshake, heartbeat,
// exponential reconnect, and a small pending-send queue.

export interface ImCredential {
  loginUserId: string;
  loginToken: string;
  wsUrl: string;
}

export interface MessageVo {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  createdAt: string;
}

export interface SessionVo {
  peerId: string;
  lastMessage: string;
  lastAt: string;
}

export interface WsMessage {
  type: string;
  fromId?: string;
  toId?: string;
  roomId?: string;
  content?: string;
  msgType?: string; // P0-14 消息内容类型 text / image；P1-18 + voice
  duration?: number; // P1-18 语音时长（秒），仅 msgType=voice
  ts?: number;
  reason?: string;
  [k: string]: unknown;
}

interface AppLike {
  globalData: { token: string; apiBase: string };
}

type PendingFrame = Record<string, unknown>;
type ImStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

const HEARTBEAT_MS = 20_000;
const MAX_RECONNECT_MS = 30_000;
const MAX_PENDING = 50;

let socket: WechatMiniprogram.SocketTask | null = null;
let cred: ImCredential | null = null;
let status: ImStatus = 'idle';
let loggedIn = false;
let manualClose = false;
let suppressCloseReconnect = false;
let reconnectAttempts = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFrames: PendingFrame[] = [];
let onMessageCb: ((m: WsMessage) => void) | null = null;
let onRoomMessageCb: ((m: WsMessage) => void) | null = null;
let onEventCb: ((m: WsMessage) => void) | null = null;

export function onMessage(cb: (m: WsMessage) => void) {
  onMessageCb = cb;
}
export function onRoomMessage(cb: (m: WsMessage) => void) {
  onRoomMessageCb = cb;
}
export function onWsEvent(cb: (m: WsMessage) => void) {
  onEventCb = cb;
}
export function isLoggedIn() {
  return loggedIn;
}
export function getImStatus() {
  return status;
}

export function connectIm(c: ImCredential): Promise<void> {
  cred = c;
  manualClose = false;
  clearReconnectTimer();
  closeActiveSocket(true);
  status = reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
  loggedIn = false;
  emitEvent({ type: 'status', status });

  return new Promise((resolve, reject) => {
    let settled = false;
    socket = wx.connectSocket({ url: c.wsUrl });
    socket.onOpen(() => {
      sendImmediate({ type: 'login', loginUserId: c.loginUserId, loginToken: c.loginToken }, false);
      startHeartbeat();
    });
    socket.onMessage((data) => {
      let m: WsMessage;
      try {
        m = JSON.parse(data.data as string) as WsMessage;
      } catch {
        return;
      }
      if (m.type === 'login_ok' && !settled) {
        settled = true;
        resolve();
      }
      if (m.type === 'login_failed' && !settled) {
        settled = true;
        reject(new Error(String(m.reason ?? 'login_failed')));
      }
      handleMessage(m);
    });
    socket.onClose(() => {
      cleanupConnection();
      if (suppressCloseReconnect) {
        suppressCloseReconnect = false;
        return;
      }
      if (!manualClose) scheduleReconnect();
    });
    socket.onError((err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
      if (!manualClose) scheduleReconnect();
    });
  });
}

function handleMessage(m: WsMessage) {
  switch (m.type) {
    case 'login_ok':
      loggedIn = true;
      status = 'connected';
      reconnectAttempts = 0;
      emitEvent(m);
      emitEvent({ type: 'status', status });
      flushPendingFrames();
      break;
    case 'login_failed':
      loggedIn = false;
      emitEvent(m);
      closeActiveSocket(false);
      scheduleReconnect();
      break;
    case 'msg':
      onMessageCb?.(m);
      break;
    case 'room-msg':
      onRoomMessageCb?.(m);
      break;
    case 'joined':
    case 'join_failed':
    case 'left':
    case 'room_event':
    case 'msg_sent':
    case 'msg_failed':
    case 'pong':
      emitEvent(m);
      break;
  }
}

function emitEvent(m: WsMessage) {
  onEventCb?.(m);
}

function enqueueOrSend(obj: PendingFrame) {
  if (loggedIn) {
    sendImmediate(obj);
    return;
  }
  pendingFrames.push(obj);
  if (pendingFrames.length > MAX_PENDING) pendingFrames = pendingFrames.slice(-MAX_PENDING);
}

function flushPendingFrames() {
  const frames = pendingFrames;
  pendingFrames = [];
  for (const frame of frames) sendImmediate(frame);
}

function sendImmediate(obj: PendingFrame, queueOnFail = true) {
  socket?.send({ data: JSON.stringify(obj), fail: () => {
    if (queueOnFail) queueFrame(obj);
  } });
}

function queueFrame(obj: PendingFrame) {
  pendingFrames.push(obj);
  if (pendingFrames.length > MAX_PENDING) pendingFrames = pendingFrames.slice(-MAX_PENDING);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (loggedIn) sendImmediate({ type: 'ping' }, false);
  }, HEARTBEAT_MS);
}
function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function scheduleReconnect() {
  if (!cred || manualClose) return;
  clearReconnectTimer();
  status = 'reconnecting';
  loggedIn = false;
  stopHeartbeat();
  emitEvent({ type: 'status', status });
  reconnectAttempts += 1;
  const delay = Math.min(MAX_RECONNECT_MS, 1000 * 2 ** Math.min(5, reconnectAttempts - 1));
  reconnectTimer = setTimeout(() => {
    if (cred && !manualClose) connectIm(cred).catch(() => scheduleReconnect());
  }, delay);
}

function clearReconnectTimer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function cleanupConnection() {
  stopHeartbeat();
  loggedIn = false;
  socket = null;
}

function closeActiveSocket(suppressReconnect: boolean) {
  stopHeartbeat();
  loggedIn = false;
  const current = socket;
  socket = null;
  if (current) {
    suppressCloseReconnect = suppressReconnect;
    current.close({});
  }
}

export function closeIm() {
  manualClose = true;
  clearReconnectTimer();
  closeActiveSocket(true);
  cred = null;
  pendingFrames = [];
  status = 'closed';
  emitEvent({ type: 'status', status });
}

export async function sendIm(
  app: AppLike,
  peerId: string,
  content: string,
): Promise<MessageVo> {
  const msg = await request<MessageVo>(app, '/chat/messages', { peerId, content }, 'POST');
  enqueueOrSend({ type: 'msg', toId: peerId, content });
  return msg;
}

export function joinRoom(roomId: string) {
  enqueueOrSend({ type: 'join', roomId });
}
export function leaveRoom(roomId: string) {
  enqueueOrSend({ type: 'leave', roomId });
}
export function sendRoomMessage(roomId: string, content: string, msgType?: string) {
  enqueueOrSend({ type: 'room-msg', roomId, content, msgType });
}

export function sendWsMessage(toId: string, content: string, msgType?: string, duration?: number) {
  enqueueOrSend({ type: 'msg', toId, content, msgType, duration });
}

export function getImToken(app: AppLike): Promise<ImCredential> {
  return request(app, '/chat/token', undefined, 'POST');
}
export function listMessages(
  app: AppLike,
  peerId: string,
  cursor?: string,
): Promise<{ list: MessageVo[]; nextCursor: string | null; hasMore: boolean }> {
  const qs = `?peerId=${encodeURIComponent(peerId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return request(app, `/chat/messages${qs}`, undefined, 'GET');
}
export function listSessions(app: AppLike): Promise<SessionVo[]> {
  return request(app, '/chat/sessions', undefined, 'GET');
}

function request<T>(
  app: AppLike,
  url: string,
  data: unknown,
  method: 'GET' | 'POST',
): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${url}`,
      method,
      data: data as WechatMiniprogram.IAnyObject | undefined,
      header: {
        'Content-Type': 'application/json',
        Authorization: app.globalData.token ? `Bearer ${app.globalData.token}` : '',
      },
      success: (r) => {
        const b = r.data as { code: number; data?: T; message?: string };
        if (b.code === 0 && b.data !== undefined) {
          resolve(b.data as T);
        } else {
          wx.showToast({ title: b.message ?? '请求失败', icon: 'none' });
          reject(new Error(b.message ?? 'fail'));
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(new Error('network'));
      },
    });
  });
}
