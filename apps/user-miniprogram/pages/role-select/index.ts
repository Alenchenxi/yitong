import type { AppInstance } from '../../app';

Page({
  data: { loading: false, pendingRole: '' },

  async chooseRole(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as 'user' | 'merchant' | 'admin';
    if (this.data.loading) return;
    this.setData({ loading: true, pendingRole: role });
    const app = getApp<AppInstance>();
    try {
      await app.loginWithRole(role);
      wx.switchTab({ url: '/pages/confession/index' });
    } catch {
      // toast 已在 loginWithRole 内
    } finally {
      this.setData({ loading: false, pendingRole: '' });
    }
  },
});
