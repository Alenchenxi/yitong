// 树洞匿名接口：用 anonToken 鉴权（独立于 user access token）

export interface AnonPostVo {
  id: string;
  anonId: string;
  content: string;
  images: string[];
  likeCount: number;
  liked: boolean;
  createdAt: string;
}

export interface AnonTokenResp {
  anonId: string;
  anonToken: string;
  nickname: string;
}

export interface ImCredential {
  loginUserId: string;
  loginToken: string;
  wsUrl: string;
}

export interface MatchResp {
  matchId?: string;
  peerAnonId?: string;
  imCredential?: ImCredential;
  waiting: boolean;
}

export interface PartyResp {
  roomId: string;
  imCredential: ImCredential;
}

export interface AnonMessageVo {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  createdAt: string;
}

let anonToken = '';
let anonId = '';

interface AppLike {
  globalData: { apiBase: string };
}

export function hasAnonToken() {
  return !!anonToken;
}
export function getAnonId() {
  return anonId;
}
export function clearAnonToken() {
  anonToken = '';
  anonId = '';
}

// 换匿名 token（用 user access token 调）
export function getAnonymousToken(): Promise<AnonTokenResp> {
  return new Promise((resolve, reject) => {
    const app = getApp<AppLike>();
    wx.request({
      url: `${app.globalData.apiBase}/treehole/anonymous-token`,
      method: 'POST',
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${(getApp() as any).globalData.token}` },
      success: (r) => {
        const b = r.data as { code: number; data?: AnonTokenResp; message?: string };
        if (b.code === 0 && b.data) {
          anonToken = b.data.anonToken;
          anonId = b.data.anonId;
          resolve(b.data);
        } else {
          wx.showToast({ title: b.message ?? '匿名态获取失败', icon: 'none' });
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

function anonRequest<T>(opts: { url: string; method: 'GET' | 'POST'; data?: unknown }): Promise<T> {
  return new Promise((resolve, reject) => {
    const app = getApp<AppLike>();
    wx.request({
      url: `${app.globalData.apiBase}${opts.url}`,
      method: opts.method,
      data: opts.data as WechatMiniprogram.IAnyObject | undefined,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonToken}` },
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

export function listPosts(cursor?: string): Promise<{ list: AnonPostVo[]; nextCursor: string | null; hasMore: boolean }> {
  const qs = `?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return anonRequest({ url: `/treehole/posts${qs}`, method: 'GET' });
}

export function getPost(id: string): Promise<AnonPostVo> {
  return anonRequest({ url: `/treehole/posts/${id}`, method: 'GET' });
}

export function createPost(data: { content: string; images?: string[] }): Promise<AnonPostVo> {
  return anonRequest({ url: '/treehole/posts', method: 'POST', data });
}

export function matchAnon(): Promise<MatchResp> {
  return anonRequest({ url: '/treehole/match', method: 'POST' });
}

export function toggleAnonPostLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  return anonRequest({ url: `/treehole/posts/${postId}/like`, method: 'POST' });
}

export function joinParty(): Promise<PartyResp> {
  return anonRequest({ url: '/treehole/party/join', method: 'POST' });
}

export function sendAnonMessage(peerAnonId: string, content: string): Promise<AnonMessageVo> {
  return anonRequest({ url: '/treehole/messages', method: 'POST', data: { peerAnonId, content } });
}

export function listAnonMessages(
  peerAnonId: string,
  cursor?: string,
): Promise<{ list: AnonMessageVo[]; nextCursor: string | null; hasMore: boolean }> {
  const qs = `?peerAnonId=${encodeURIComponent(peerAnonId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return anonRequest({ url: `/treehole/messages${qs}`, method: 'GET' });
}
