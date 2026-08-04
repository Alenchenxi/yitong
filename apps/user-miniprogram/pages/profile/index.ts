import type { AppInstance } from '../../app';
import { listNotifications } from '../../services/notification';

function roleLabel(r: string): string {
  return r === 'USER' ? '普通用户' : r === 'MERCHANT' ? '商家' : r === 'ADMIN' ? '管理员' : r;
}

Page({
  data: {
    user: null as { nickname: string; avatarUrl: string | null; roles: string[] } | null,
    avatarChar: '?',
    currentRole: '',
    roleText: '',
    unreadCount: 0,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const u = app.globalData.user;
    const currentRole = app.globalData.currentRole;
    this.setData({
      user: u,
      avatarChar: u ? u.nickname.slice(0, 1) : '?',
      currentRole,
      roleText: roleLabel(currentRole),
    });
    try {
      const resp = await listNotifications(false, 1);
      this.setData({ unreadCount: resp.unreadCount });
    } catch {
      this.setData({ unreadCount: 0 });
    }
  },

  goMyPosts() {
    wx.navigateTo({ url: '/pages/my-posts/index' });
  },

  goFollowing() {
    wx.navigateTo({ url: '/pages/follow-list/index?mode=following' });
  },

  goFollowers() {
    wx.navigateTo({ url: '/pages/follow-list/index?mode=followers' });
  },

  goMyTreehole() {
    wx.navigateTo({ url: '/pages/my-anon-posts/index' });
  },

  goMyJobs() {
    wx.navigateTo({ url: '/pages/job/my-applications/index' });
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },

  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/index' });
  },

  goReferral() {
    wx.navigateTo({ url: '/pages/referral/index' });
  },

  goMerchant() {
    // 统一进商家 shell（未入驻由 shell 探测跳入驻）
    wx.navigateTo({ url: '/pages/merchant/index' });
  },

  goAccountSecurity() {
    wx.navigateTo({ url: '/pages/account-security/index' });
  },

  goResume() {
    wx.navigateTo({ url: '/pages/resume/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' });
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/index' });
  },

  goHelp() {
    wx.navigateTo({ url: '/pages/help/index' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '将返回角色选择页',
      success: (r) => {
        if (r.confirm) {
          getApp<AppInstance>().logout();
        }
      },
    });
  },
});
