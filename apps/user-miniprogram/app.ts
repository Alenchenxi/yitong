import {
  loginWithRole as loginWithRoleUtil,
  switchRole as switchRoleUtil,
  restoreAuth,
  clearAuth,
  type UserInfo,
} from './utils/auth';
import { getAnonymousToken } from './services/treehole';

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
    anonToken: '', // CR-001 树洞匿名 token
    anonId: '',    // CR-001 当前 anonId
  },

  onLaunch() {
    // 从 storage 恢复登录态；有 token 则按当前角色直进对应端首页
    if (restoreAuth(this)) {
      this.globalData.loginReady = true;
      this.routeToRoleHome(this.globalData.currentRole);
      return;
    }
    // 无缓存 token → 首次进入小程序，自动以 user 身份登录直进广场
    // 失败静默留在 role-select 页（pages[0]），用户可手动选角色
    this.loginWithRole('user').then(() => {
      this.routeToRoleHome('user');
    }).catch(() => {});
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
      // user 落地广场(tabBar 左一)：reLaunch 与 merchant/admin 统一，规避 onLaunch 阶段 switchTab 偶发失效
      wx.reLaunch({ url: '/pages/square/index' });
    }
  },

  async loginWithRole(role: 'user' | 'merchant' | 'admin', referralCode?: string) {
    await loginWithRoleUtil(role, this, referralCode);
    this.globalData.loginReady = true;
    // CR-001: 登录后尝试签发 anonToken（user 角色进广场需要；失败不影响登录流程）
    if (role === 'user') {
      getAnonymousToken().catch(() => {}); // 静默失败：首次未访问树洞无匿名身份，进入树洞时重试
    }
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
    anonToken: string;
    anonId: string;
    loginReady: boolean;
  };
  loginWithRole: (role: 'user' | 'merchant' | 'admin', referralCode?: string) => Promise<void>;
  switchRole: (role: 'user' | 'merchant' | 'admin') => Promise<void>;
  logout: () => void;
  requireAuth: () => boolean;
  routeToRoleHome: (role: string) => void;
}>;
