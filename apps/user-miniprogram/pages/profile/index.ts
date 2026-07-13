import type { AppInstance } from '../../app';

interface RoleItem {
  key: 'user' | 'merchant' | 'admin';
  label: string;
  current: boolean;
}

function roleLabel(r: string): string {
  return r === 'USER' ? '普通用户' : r === 'MERCHANT' ? '商家' : r === 'ADMIN' ? '管理员' : r;
}
function roleKey(r: string): 'user' | 'merchant' | 'admin' {
  return r === 'USER' ? 'user' : r === 'MERCHANT' ? 'merchant' : 'admin';
}

Page({
  data: {
    user: null as { nickname: string; avatarUrl: string | null; roles: string[] } | null,
    avatarChar: '?',
    currentRole: '',
    roleText: '',
    roleList: [] as RoleItem[],
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const u = app.globalData.user;
    const currentRole = app.globalData.currentRole;
    const roles = u?.roles ?? [];
    this.setData({
      user: u,
      avatarChar: u ? u.nickname.slice(0, 1) : '?',
      currentRole,
      roleText: roleLabel(currentRole),
      roleList: roles.map((r) => ({ key: roleKey(r), label: roleLabel(r), current: r === currentRole })),
    });
  },

  goMyPosts() {
    wx.showToast({ title: '开发中', icon: 'none' });
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },

  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/index' });
  },

  goMerchant() {
    wx.navigateTo({ url: '/pages/merchant/register/index' });
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/index' });
  },

  async switchRole(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as 'user' | 'merchant' | 'admin';
    const app = getApp<AppInstance>();
    if (role === roleKey(app.globalData.currentRole)) return;
    wx.showLoading({ title: '切换中…', mask: true });
    try {
      await app.switchRole(role);
      const cur = app.globalData.currentRole;
      this.setData({
        currentRole: cur,
        roleText: roleLabel(cur),
        roleList: (app.globalData.user?.roles ?? []).map((r) => ({
          key: roleKey(r),
          label: roleLabel(r),
          current: r === cur,
        })),
      });
      wx.showToast({ title: '已切换', icon: 'success' });
    } catch {
      // toast 已弹
    } finally {
      wx.hideLoading();
    }
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
