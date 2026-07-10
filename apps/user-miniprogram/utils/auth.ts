// 登录态管理：角色选择登录 / 静默切换角色 / storage 持久化

export interface UserInfo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  roles: string[]; // 拥有的角色集合
}

interface LoginResp {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
  role: string; // 当前角色
}

const STORAGE_KEY = 'yitong_auth';

interface AppLike {
  globalData: {
    token: string;
    refreshToken: string;
    user: UserInfo | null;
    currentRole: string;
    apiBase: string;
  };
}

// 从 storage 恢复登录态；返回是否有 token
export function restoreAuth(app: AppLike): boolean {
  const cached = wx.getStorageSync(STORAGE_KEY) as {
    token: string;
    refreshToken: string;
    user: UserInfo;
    currentRole: string;
  } | '';
  if (cached && cached.token) {
    app.globalData.token = cached.token;
    app.globalData.refreshToken = cached.refreshToken;
    app.globalData.user = cached.user;
    app.globalData.currentRole = cached.currentRole;
    return true;
  }
  return false;
}

function persist(app: AppLike, data: LoginResp) {
  app.globalData.token = data.accessToken;
  app.globalData.refreshToken = data.refreshToken;
  app.globalData.user = data.user;
  app.globalData.currentRole = data.role;
  wx.setStorageSync(STORAGE_KEY, {
    token: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
    currentRole: data.role,
  });
}

// 角色选择登录：wx.login -> /auth/wx-login { code, role }
export function loginWithRole(
  role: 'user' | 'merchant' | 'admin',
  app: AppLike,
): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (lr) => {
        if (!lr.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' });
          reject(new Error('no code'));
          return;
        }
        try {
          const data = await post<LoginResp>(app, '/auth/wx-login', { code: lr.code, role }, false);
          persist(app, data);
          resolve();
        } catch (e) {
          reject(e);
        }
      },
      fail: (err) => reject(err),
    });
  });
}

// 静默切换角色：POST /auth/switch-role { role }（需当前 token）
export function switchRole(
  role: 'user' | 'merchant' | 'admin',
  app: AppLike,
): Promise<void> {
  return post<LoginResp>(app, '/auth/switch-role', { role }, true).then((data) => {
    persist(app, data);
  });
}

export function clearAuth(app: AppLike) {
  app.globalData.token = '';
  app.globalData.refreshToken = '';
  app.globalData.user = null;
  app.globalData.currentRole = '';
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

// 内部 POST：返回 data；auth=true 带 Bearer
function post<T>(app: AppLike, url: string, body: unknown, auth: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const header: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth && app.globalData.token) header.Authorization = `Bearer ${app.globalData.token}`;
    wx.request({
      url: `${app.globalData.apiBase}${url}`,
      method: 'POST',
      data: body as WechatMiniprogram.IAnyObject,
      header,
      success: (r) => {
        const b = r.data as { code: number; data?: T; message?: string };
        if (b.code === 0 && b.data !== undefined) {
          resolve(b.data as T);
        } else {
          wx.showToast({ title: b.message ?? '请求失败', icon: 'none' });
          reject(new Error(b.message ?? 'failed'));
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(new Error('network'));
      },
    });
  });
}
