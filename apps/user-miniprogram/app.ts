import {
  loginWithRole as loginWithRoleUtil,
  switchRole as switchRoleUtil,
  restoreAuth,
  clearAuth,
  type UserInfo,
} from './utils/auth';

App({
  globalData: {
    token: '',
    refreshToken: '',
    user: null as UserInfo | null,
    currentRole: '',
    apiBase: 'http://localhost:3000/api/v1',
    loginReady: false,
  },

  onLaunch() {
    // 从 storage 恢复登录态；无 token 则等角色选择页显式登录
    if (restoreAuth(this)) {
      this.globalData.loginReady = true;
    }
  },

  async loginWithRole(role: 'user' | 'merchant' | 'admin') {
    await loginWithRoleUtil(role, this);
    this.globalData.loginReady = true;
  },

  async switchRole(role: 'user' | 'merchant' | 'admin') {
    await switchRoleUtil(role, this);
  },

  logout() {
    clearAuth(this);
    this.globalData.loginReady = false;
    wx.reLaunch({ url: '/pages/role-select/index' });
  },

  // 页面调用：若无 token 跳角色选择页，返回 false
  requireAuth(): boolean {
    if (this.globalData.token) return true;
    wx.reLaunch({ url: '/pages/role-select/index' });
    return false;
  },
});

export type AppInstance = WechatMiniprogram.App.Instance<{
  globalData: {
    token: string;
    refreshToken: string;
    user: UserInfo | null;
    currentRole: string;
    apiBase: string;
    loginReady: boolean;
  };
  loginWithRole: (role: 'user' | 'merchant' | 'admin') => Promise<void>;
  switchRole: (role: 'user' | 'merchant' | 'admin') => Promise<void>;
  logout: () => void;
  requireAuth: () => boolean;
}>;
