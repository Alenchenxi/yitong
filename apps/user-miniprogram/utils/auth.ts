// 登录态管理：wx.login → code → /auth/wx-login → token/user 存 storage+globalData
import type { AppInstance } from '../app';

interface LoginResp {
  accessToken: string;
  refreshToken: string;
  user: { id: string; nickname: string; avatarUrl: string | null; role: string };
}

type MeResp = NonNullable<AppInstance['globalData']['user']>;

const STORAGE_KEY = 'yitong_auth';

// 静默登录：已有 token 直接使用；否则 wx.login 换 token
export async function ensureLogin(app: AppInstance): Promise<MeResp | null> {
  const cached = wx.getStorageSync(STORAGE_KEY) as { token: string; refreshToken: string; user: MeResp } | '';
  if (cached && cached.token) {
    app.globalData.token = cached.token;
    app.globalData.refreshToken = cached.refreshToken;
    app.globalData.user = cached.user;
    return cached.user;
  }

  return new Promise((resolve, reject) => {
    wx.login({
      success: async (lr) => {
        if (!lr.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' });
          reject(new Error('no code'));
          return;
        }
        try {
          const resp = await new Promise<LoginResp>((res, rej) => {
            wx.request({
              url: `${app.globalData.apiBase}/auth/wx-login`,
              method: 'POST',
              data: { code: lr.code, role: 'user' },
              header: { 'Content-Type': 'application/json' },
              success: (r) => {
                const body = r.data as { code: number; data?: LoginResp; message?: string };
                if (body.code === 0 && body.data) {
                  res(body.data);
                } else {
                  rej(new Error(body.message ?? 'login failed'));
                }
              },
              fail: () => rej(new Error('network')),
            });
          });
          app.globalData.token = resp.accessToken;
          app.globalData.refreshToken = resp.refreshToken;
          app.globalData.user = resp.user;
          wx.setStorageSync(STORAGE_KEY, {
            token: resp.accessToken,
            refreshToken: resp.refreshToken,
            user: resp.user,
          });
          // 登录后立即拉一次 me 更新昵称/头像
          const me = await fetchMe(app);
          resolve(me);
        } catch (e) {
          wx.showToast({ title: '登录失败，请重试', icon: 'none' });
          reject(e);
        }
      },
      fail: (err) => reject(err),
    });
  });
}

// 拉取 me（个人资料）
export function fetchMe(app: AppInstance): Promise<MeResp> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}/auth/me`,
      method: 'GET',
      header: { Authorization: `Bearer ${app.globalData.token}` },
      success: (r) => {
        const body = r.data as { code: number; data?: MeResp; message?: string };
        if (body.code === 0 && body.data) {
          app.globalData.user = body.data;
          const cached = wx.getStorageSync(STORAGE_KEY);
          if (cached) {
            wx.setStorageSync(STORAGE_KEY, { ...cached, user: body.data });
          }
          resolve(body.data);
        } else {
          // 401 → 清缓存
          if (r.statusCode === 401) {
            clearAuth(app);
          }
          reject(new Error(body.message ?? 'me failed'));
        }
      },
      fail: () => reject(new Error('network')),
    });
  });
}

export function clearAuth(app: AppInstance) {
  app.globalData.token = '';
  app.globalData.refreshToken = '';
  app.globalData.user = null;
  wx.removeStorageSync(STORAGE_KEY);
}

// 相对时间：今天 HH:mm，昨天，更早 YYYY-MM-DD
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yest = new Date(now.getTime() - 86400000);
  const isYest =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (sameDay) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (isYest) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
