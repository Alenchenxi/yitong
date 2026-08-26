import type { AppInstance } from '../../app';

Page({
  data: {
    loading: false,
    pendingRole: '',
    referralCode: '',
    referralTip: '',
  },

  onLoad(options: { referralCode?: string }) {
    // 分享落地：携带 referralCode（仅对新用户首次注册生效）
    if (options?.referralCode) {
      this.setData({
        referralCode: options.referralCode,
        referralTip: `你通过邀请码 ${options.referralCode} 进入`,
      });
    }
  },

  async chooseRole(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as 'user' | 'merchant' | 'admin';
    if (this.data.loading) return;
    this.setData({ loading: true, pendingRole: role });
    const app = getApp<AppInstance>();
    try {
      await app.loginWithRole(role, this.data.referralCode || undefined);
      if (app.globalData.pendingCommunityInviteId) {
        // 邀请请求因登录过期回到本页时，登录成功后继续切回用户广场消费邀请。
        app.routeCommunityInviteToSquare();
      } else {
        // 按角色分流落地页（与 onLaunch 恢复登录态共用 routeToRoleHome，避免逻辑漂移）
        app.routeToRoleHome(role);
      }
    } catch {
      // toast 已在 loginWithRole 内
    } finally {
      this.setData({ loading: false, pendingRole: '' });
    }
  },
});
