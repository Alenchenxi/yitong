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
      // 按角色分流落地页：user 进表白墙(tabBar)，merchant 进招聘列表(商家首页)，admin 进管理端
      if (role === 'merchant') {
        wx.reLaunch({ url: '/pages/job/manage/index' });
      } else if (role === 'admin') {
        wx.reLaunch({ url: '/pages/admin/index' });
      } else {
        wx.switchTab({ url: '/pages/confession/index' });
      }
    } catch {
      // toast 已在 loginWithRole 内
    } finally {
      this.setData({ loading: false, pendingRole: '' });
    }
  },
});
