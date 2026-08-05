import {
  loginWithRole as loginWithRoleUtil,
  switchRole as switchRoleUtil,
  restoreAuth,
  clearAuth,
  type UserInfo,
} from './utils/auth';

// 按小程序运行环境自动选 apiBase：develop=开发者工具(连本机 dev)，trial/release=体验/正式版(连生产)
const __envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
const apiBase = __envVersion === 'develop'
  ? 'http://localhost:3000/api/v1'
  : 'https://yitongjiajiao.com/api/v1';

App({
  globalData: {
    token: '',
    refreshToken: '',
    user: null as UserInfo | null,
    currentRole: '',
    apiBase,
    loginReady: false,
  },

  onLaunch() {
    // 从 storage 恢复登录态；有 token 则按当前角色直进对应端首页
    if (restoreAuth(this)) {
      this.globalData.loginReady = true;
      this.routeToRoleHome(this.globalData.currentRole);
    }
    // 无 token 不 reLaunch：启动页即 role-select（pages[0]），会自然渲染三张角色卡片；
    // 若开发者工具以其他页为编译入口，该页 onLoad 的 requireAuth() 会跳回 role-select。
    // 原先 else 分支 reLaunch 到启动页自身，会中断首屏渲染导致白屏（lib 3.17.0 复现）。
  },

  // 按角色跳转对应端首页：user 表白墙(tabBar) / merchant 招聘列表(商家首页) / admin 管理端
  // onLaunch 恢复登录态（currentRole 为后端 Role 枚举大写）+ role-select 登录成功（传小写 role）共用此逻辑，统一 toLowerCase 兼容
  routeToRoleHome(role: string) {
    const r = role.toLowerCase();
    if (r === 'merchant') {
      wx.reLaunch({ url: '/pages/merchant/index' });
    } else if (r === 'admin') {
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
