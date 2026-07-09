import { ensureLogin } from './utils/auth';

interface UserInfo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
}

App({
  globalData: {
    token: '',
    refreshToken: '',
    user: null as UserInfo | null,
    apiBase: 'http://localhost:3000/api/v1',
    loginReady: false, // 登录是否完成，page 可在 onShow 中轮询等待
  },

  onLaunch() {
    // 登录异步发起，页面通过 onShow 里的 waitLogin() 等待
    this.doLogin().catch(() => {
      // 登录失败静默处理，页面会重试提示
    });
  },

  async doLogin() {
    try {
      await ensureLogin(this);
      this.globalData.loginReady = true;
      // 广播给已注册的等待者
      this._loginWaiters?.forEach((w) => w.resolve(this.globalData.user));
      this._loginWaiters = [];
    } catch (e) {
      this._loginWaiters?.forEach((w) => w.reject(e));
      this._loginWaiters = [];
      throw e;
    }
  },

  // 页面调用以等待登录完成；若已完成立即返回 user
  waitLogin(): Promise<UserInfo | null> {
    if (this.globalData.loginReady) {
      return Promise.resolve(this.globalData.user);
    }
    return new Promise((resolve, reject) => {
      this._loginWaiters = this._loginWaiters ?? [];
      this._loginWaiters.push({ resolve, reject });
    });
  },

  _loginWaiters: [] as Array<{ resolve: (u: UserInfo | null) => void; reject: (e: unknown) => void }>,
});

// 供 utils/auth 使用的类型别名
export type AppInstance = WechatMiniprogram.App.Instance<{
  globalData: {
    token: string;
    refreshToken: string;
    user: UserInfo | null;
    apiBase: string;
    loginReady: boolean;
  };
  waitLogin: () => Promise<UserInfo | null>;
}>;
