import {
  loginWithRole as loginWithRoleUtil,
  switchRole as switchRoleUtil,
  restoreAuth,
  clearAuth,
  type UserInfo,
} from './utils/auth';
import { getAnonymousToken } from './services/treehole';
import {
  fetchAnonymousContentVisibility,
  persistAnonymousContentVisibility,
  readAnonymousContentVisibilityCache,
} from './services/app-config';
import { getAdminAccess, type AdminAccessVo } from './services/admin';

// 按小程序运行环境自动选 apiBase：develop=开发者工具(连本机 dev)，trial/release=体验/正式版(连生产)
// FORCE_PRODUCTION 开关：true=开发者工具(develop)也强制连生产 yitongjiajiao.cn（本地不跑 server 调试真数据用）；
//   false=自动切换（develop→localhost:3000，trial/release→生产）。上线联调完记得翻回 false。
const FORCE_PRODUCTION = true;
const __envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
const PROD_API_BASE = 'https://yitongjiajiao.cn/api/v1';
const apiBase = FORCE_PRODUCTION
  ? PROD_API_BASE
  : __envVersion === 'develop'
    ? 'http://localhost:3000/api/v1'
    : PROD_API_BASE;
const cachedAnonymousContentEnabled = readAnonymousContentVisibilityCache();
const ANONYMOUS_CONTENT_RETRY_DELAYS_MS = [250, 750] as const;
const ADMIN_ACCESS_STORAGE_KEY = 'yitong_admin_access';
const cachedAdminAccess = wx.getStorageSync(ADMIN_ACCESS_STORAGE_KEY) as AdminAccessVo | '';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAnonymousContentVisibilityWithRetry(): Promise<boolean> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchAnonymousContentVisibility();
    } catch (error) {
      const retryDelay = ANONYMOUS_CONTENT_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined) throw error;
      await delay(retryDelay);
    }
  }
}

function responseErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = Number((error as { code?: unknown }).code);
  return Number.isFinite(code) ? code : null;
}

App({
  globalData: {
    token: '',
    refreshToken: '',
    user: null as UserInfo | null,
    currentRole: '',
    apiBase,
    loginReady: false,
    anonymousContentEnabled: cachedAnonymousContentEnabled,
    adminAccess: cachedAdminAccess || null,
    anonToken: '', // CR-001 树洞匿名 token
    anonId: '',    // CR-001 当前 anonId
    activeCommunityId: '', // 圈子：当前圈子 id（广场头卡/作用域；切换后更新）
    joinGate: false, // 圈子：加入页门闩（广场 onShow 未加入时只跳一次，返回不再无限跳）
    pendingCommunityInviteId: '', // 分享邀请：冷/热启动先暂存，登录后由广场幂等消费
    communityInviteRouting: false, // 分享邀请：角色切换/重进广场期间防止 onLaunch、onShow 重复路由
  },

  onLaunch(options) {
    const inviteCommunityId = options.query?.inviteCommunityId;
    if (typeof inviteCommunityId === 'string' && inviteCommunityId) {
      this.globalData.pendingCommunityInviteId = inviteCommunityId;
    }
    // 从 storage 恢复登录态；有 token 则按当前角色直进对应端首页
    if (restoreAuth(this)) {
      this.globalData.loginReady = true;
      // 分享邀请优先落到用户广场；普通启动仍按上次角色进入对应首页。
      if (this.globalData.pendingCommunityInviteId) {
        this.routeCommunityInviteToSquare();
        return;
      }
      this.routeToRoleHome(this.globalData.currentRole);
      return;
    }
    // 无缓存 token → 首次进入小程序，自动以 user 身份登录直进广场
    // 失败静默留在 role-select 页（pages[0]），用户可手动选角色
    this.loginWithRole('user').then(() => {
      if (this.globalData.pendingCommunityInviteId) {
        this.routeCommunityInviteToSquare();
      } else {
        this.routeToRoleHome('user');
      }
    }).catch(() => {});
  },

  onShow(options) {
    void this.refreshAnonymousContentVisibility();
    if (this.globalData.currentRole === 'admin' && this.globalData.token) {
      void this.refreshAdminAccess();
    }
    const inviteCommunityId = options.query?.inviteCommunityId;
    if (typeof inviteCommunityId === 'string' && inviteCommunityId) {
      this.globalData.pendingCommunityInviteId = inviteCommunityId;
    }
    if (this.globalData.pendingCommunityInviteId && this.globalData.token) {
      this.routeCommunityInviteToSquare();
    }
  },

  // 分享邀请统一路由：用户热启动时重进广场；商家/管理角色先切回用户端。
  // 邀请 id 由广场 onShow 幂等消费，路由层只负责确保用户到达正确页面。
  async routeCommunityInviteToSquare() {
    if (
      !this.globalData.pendingCommunityInviteId
      || !this.globalData.token
      || this.globalData.communityInviteRouting
    ) {
      return;
    }

    const pages = getCurrentPages();
    const currentRoute = pages.length ? pages[pages.length - 1]?.route : '';
    const isUserRole = this.globalData.currentRole.toLowerCase() === 'user';
    if (isUserRole && currentRoute === 'pages/square/index') {
      return;
    }

    this.globalData.communityInviteRouting = true;
    try {
      if (!isUserRole) {
        await switchRoleUtil('user', this);
      }
      await new Promise<void>((resolve, reject) => {
        wx.reLaunch({
          url: '/pages/square/index',
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });
    } catch (error) {
      const code = responseErrorCode(error);
      if (code === 10001 || code === 10002) {
        // 商家/管理角色的缓存 token 已失效：保留邀请，仅清登录态并回登录页续接。
        clearAuth(this);
        this.globalData.loginReady = false;
        wx.reLaunch({ url: '/pages/role-select/index' });
      }
      // 网络失败等可恢复错误保留 pendingCommunityInviteId，用户下次 onShow 可继续消费。
    } finally {
      this.globalData.communityInviteRouting = false;
    }
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
    if (role === 'user' && await this.getAnonymousContentVisibility()) {
      getAnonymousToken().catch(() => {});
    }
    // 当前圈子统一由广场 onShow 拉取；避免登录预加载与邀请切换并发时旧响应回写。
  },

  async switchRole(role: 'user' | 'merchant' | 'admin') {
    await switchRoleUtil(role, this);
    if (role === 'user' && await this.getAnonymousContentVisibility()) {
      getAnonymousToken().catch(() => {});
    }
  },

  setAnonymousContentVisibility(enabled: boolean) {
    this._anonymousContentRefreshVersion += 1;
    this.applyAnonymousContentVisibility(enabled);
  },

  applyAnonymousContentVisibility(enabled: boolean) {
    this.globalData.anonymousContentEnabled = enabled;
    persistAnonymousContentVisibility(enabled);
    for (const listener of this._anonymousContentListeners) listener(enabled);
  },

  applyAnonymousContentRefresh(refreshVersion: number, enabled: boolean) {
    if (refreshVersion !== this._anonymousContentRefreshVersion) {
      return this.globalData.anonymousContentEnabled;
    }
    this.applyAnonymousContentVisibility(enabled);
    return enabled;
  },

  refreshAnonymousContentVisibility(): Promise<boolean> {
    if (this._anonymousContentRefreshPromise) {
      return this._anonymousContentRefreshPromise;
    }

    const refreshVersion = this._anonymousContentRefreshVersion + 1;
    this._anonymousContentRefreshVersion = refreshVersion;
    const refreshPromise = fetchAnonymousContentVisibilityWithRetry()
      .then((enabled) => this.applyAnonymousContentRefresh(refreshVersion, enabled))
      .catch(() => this.applyAnonymousContentRefresh(refreshVersion, false))
      .finally(() => {
        if (this._anonymousContentRefreshPromise === refreshPromise) {
          this._anonymousContentRefreshPromise = null;
        }
      });
    this._anonymousContentRefreshPromise = refreshPromise;
    return refreshPromise;
  },

  getAnonymousContentVisibility(): Promise<boolean> {
    return this._anonymousContentRefreshPromise
      ?? Promise.resolve(this.globalData.anonymousContentEnabled);
  },

  refreshAdminAccess(): Promise<AdminAccessVo | null> {
    if (this._adminAccessRefreshPromise) return this._adminAccessRefreshPromise;
    const promise = getAdminAccess()
      .then((access) => {
        this.globalData.adminAccess = access;
        wx.setStorageSync(ADMIN_ACCESS_STORAGE_KEY, access);
        return access;
      })
      .catch(() => {
        this.globalData.adminAccess = null;
        wx.removeStorageSync(ADMIN_ACCESS_STORAGE_KEY);
        return null;
      })
      .finally(() => {
        if (this._adminAccessRefreshPromise === promise) {
          this._adminAccessRefreshPromise = null;
        }
      });
    this._adminAccessRefreshPromise = promise;
    return promise;
  },

  subscribeAnonymousContentVisibility(listener: (enabled: boolean) => void) {
    this._anonymousContentListeners.push(listener);
    listener(this.globalData.anonymousContentEnabled);
    return () => {
      this._anonymousContentListeners = this._anonymousContentListeners
        .filter((candidate) => candidate !== listener);
    };
  },

  logout() {
    clearAuth(this);
    this.globalData.adminAccess = null;
    wx.removeStorageSync(ADMIN_ACCESS_STORAGE_KEY);
    this.globalData.loginReady = false;
    wx.reLaunch({ url: '/pages/role-select/index' });
  },

  // 页面调用：若无 token 跳角色选择页，返回 false
  requireAuth(): boolean {
    if (this.globalData.token) return true;
    wx.reLaunch({ url: '/pages/role-select/index' });
    return false;
  },

  _anonymousContentRefreshPromise: null as Promise<boolean> | null,
  _anonymousContentRefreshVersion: 0,
  _anonymousContentListeners: [] as Array<(enabled: boolean) => void>,
  _adminAccessRefreshPromise: null as Promise<AdminAccessVo | null> | null,
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
    activeCommunityId: string;
    joinGate: boolean;
    pendingCommunityInviteId: string;
    communityInviteRouting: boolean;
    loginReady: boolean;
    anonymousContentEnabled: boolean;
    adminAccess: AdminAccessVo | null;
  };
  loginWithRole: (role: 'user' | 'merchant' | 'admin', referralCode?: string) => Promise<void>;
  switchRole: (role: 'user' | 'merchant' | 'admin') => Promise<void>;
  logout: () => void;
  requireAuth: () => boolean;
  routeToRoleHome: (role: string) => void;
  routeCommunityInviteToSquare: () => Promise<void>;
  setAnonymousContentVisibility: (enabled: boolean) => void;
  refreshAnonymousContentVisibility: () => Promise<boolean>;
  getAnonymousContentVisibility: () => Promise<boolean>;
  subscribeAnonymousContentVisibility: (listener: (enabled: boolean) => void) => () => void;
  refreshAdminAccess: () => Promise<AdminAccessVo | null>;
}>;
