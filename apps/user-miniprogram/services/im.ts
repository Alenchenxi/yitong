// IM 管理器骨架：连接 MobileIMSDK 服务端 + 收发消息 + 历史拉取。
// 真实 MobileIMSDK 小程序端 SDK（纯 JS 文件）接入待获取 SDK 后替换 connect/send 内部实现；
// 当前：mock wsUrl 时跳过 socket，仅用 HTTP 拉历史消息。

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

interface AppLike {
  globalData: { token: string; apiBase: string };
}

let socket: WechatMiniprogram.SocketTask | null = null;
let onMessageCb: ((m: MessageVo) => void) | null = null;

export function onMessage(cb: (m: MessageVo) => void) {
  onMessageCb = cb;
}

// 连接 IM 服务端
export function connectIm(cred: ImCredential): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!cred.wsUrl || cred.wsUrl.startsWith('ws://mock')) {
      // eslint-disable-next-line no-console
      console.warn('[im] mock wsUrl, skip connect');
      resolve();
      return;
    }
    // TODO: 接入 MobileIMSDK 小程序端 SDK 的 loginImpl(cred)（自带 QoS/心跳/重连）
    // 当前用原生 wx.connectSocket 占位，不含 QoS/重连，真实接入需换 SDK
    socket = wx.connectSocket({ url: cred.wsUrl });
    socket.onOpen(() => resolve());
    socket.onError((err) => reject(err));
    socket.onMessage((data) => {
      try {
        const m = JSON.parse(data.data as string) as MessageVo;
        onMessageCb?.(m);
      } catch {
        /* 真实 SDK 会按 Protocal 解析，占位忽略 */
      }
    });
  });
}

export function closeIm() {
  socket?.close({});
  socket = null;
}

// 发消息：HTTP 落库（/chat/messages）；真实 IM 实时传输由 MobileIMSDK SDK send 负责（TODO）
export function sendIm(app: AppLike, peerId: string, content: string): Promise<MessageVo> {
  return request<MessageVo>(app, '/chat/messages', { peerId, content }, 'POST');
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

export function getImToken(app: AppLike): Promise<ImCredential> {
  return request(app, '/chat/token', undefined, 'POST');
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
