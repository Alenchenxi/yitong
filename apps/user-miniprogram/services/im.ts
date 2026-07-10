// IM 管理器（自建 ws 版）：wx.connectSocket 直连后端 ChatGateway + 心跳 + 断线重连。
// 协议：JSON 帧。login 鉴权 -> msg(1v1) / join/leave/room-msg(房间) / ping。

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
  ts?: number;
  [k: string]: unknown;
}

interface AppLike {
  globalData: { token: string; apiBase: string };
}

let socket: WechatMiniprogram.SocketTask | null = null;
let cred: ImCredential | null = null;
let loggedIn = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

// 连接 ChatGateway
export function connectIm(c: ImCredential): Promise<void> {
  cred = c;
  loggedIn = false;
  return new Promise((resolve, reject) => {
    socket = wx.connectSocket({ url: c.wsUrl });
    socket.onOpen(() => {
      sendRaw({ type: 'login', loginUserId: c.loginUserId, loginToken: c.loginToken });
      startHeartbeat();
      resolve();
    });
    socket.onMessage((data) => {
      let m: WsMessage;
      try {
        m = JSON.parse(data.data as string) as WsMessage;
      } catch {
        return;
      }
      handleMessage(m);
    });
    socket.onClose(() => {
      stopHeartbeat();
      loggedIn = false;
      scheduleReconnect();
    });
    socket.onError((err) => reject(err));
  });
}

function handleMessage(m: WsMessage) {
  switch (m.type) {
    case 'login_ok':
      loggedIn = true;
      onEventCb?.(m);
      break;
    case 'login_failed':
      loggedIn = false;
      onEventCb?.(m);
      break;
    case 'msg':
      onMessageCb?.(m);
      break;
    case 'room-msg':
      onRoomMessageCb?.(m);
      break;
    case 'joined':
    case 'left':
    case 'room_event':
    case 'msg_sent':
    case 'pong':
      onEventCb?.(m);
      break;
  }
}

function sendRaw(obj: Record<string, unknown>) {
  socket?.send({ data: JSON.stringify(obj), fail: () => {} });
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => sendRaw({ type: 'ping' }), 20_000);
}
function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function scheduleReconnect() {
  if (!cred) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (cred) connectIm(cred).catch(() => {});
  }, 3000);
}

export function closeIm() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  stopHeartbeat();
  socket?.close({});
  socket = null;
  cred = null;
  loggedIn = false;
}

// 1v1 发消息：HTTP 落库 + ws 实时转发
export async function sendIm(
  app: AppLike,
  peerId: string,
  content: string,
): Promise<MessageVo> {
  const msg = await request<MessageVo>(app, '/chat/messages', { peerId, content }, 'POST');
  sendRaw({ type: 'msg', toId: peerId, content });
  return msg;
}

// 房间原语
export function joinRoom(roomId: string) {
  sendRaw({ type: 'join', roomId });
}
export function leaveRoom(roomId: string) {
  sendRaw({ type: 'leave', roomId });
}
export function sendRoomMessage(roomId: string, content: string) {
  sendRaw({ type: 'room-msg', roomId, content });
}

// HTTP：历史 + 会话 + 换凭证
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
