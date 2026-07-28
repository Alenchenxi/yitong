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
    // 从 storage 恢复登录态；无 token 则跳角色选择页（启动页即角色选择，双重保险）
    if (restoreAuth(this)) {
      this.globalData.loginReady = true;
      // 已登录：按当前角色直接进对应端首页，避免重启后停在默认启动页
      // （开发者工具编译模式启动页常为表白墙，会使 merchant/admin 误显用户端内容）
      this.routeToRoleHome(this.globalData.currentRole);
    } else {
      // 启动页若不是 role-select（如开发者工具直接打开某 tab 页），强制回到角色选择
      wx.reLaunch({ url: '/pages/role-select/index' });
    }
  },

  // 按角色跳转对应端首页：user 表白墙(tabBar) / merchant 招聘列表(商家首页) / admin 管理端
  // onLaunch 恢复登录态后 + role-select 登录成功后共用此逻辑，保证「进哪个端展示哪个端」
  routeToRoleHome(role: string) {
    if (role === 'merchant') {
      wx.reLaunch({ url: '/pages/job/manage/index' });
    } else if (role === 'admin') {
      wx.reLaunch({ url: '/pages/admin/index' });
    } else {
      // user 落地表白墙(tabBar)：reLaunch 与 merchant/admin 统一，规避 onLaunch 阶段 switchTab 偶发失效
      wx.reLaunch({ url: '/pages/confession/index' });
    }
  },

  async loginWithRole(role: 'user' | 'merchant' | 'admin', referralCode?: string) {
    await loginWithRoleUtil(role, this, referralCode);
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
  loginWithRole: (role: 'user' | 'merchant' | 'admin', referralCode?: string) => Promise<void>;
  switchRole: (role: 'user' | 'merchant' | 'admin') => Promise<void>;
  logout: () => void;
  requireAuth: () => boolean;
  routeToRoleHome: (role: string) => void;
}>;
