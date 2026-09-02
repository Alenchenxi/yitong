import type { AppInstance } from '../../app';
import { listNotifications } from '../../services/notification';
import { refreshRoles, ALL_ROLES, roleLabel } from '../../services/auth';

async function countVisibleUnreadNotifications(anonymousContentEnabled: boolean): Promise<number> {
  if (anonymousContentEnabled) {
    return (await listNotifications(true, 1)).unreadCount;
  }
  let page = 1;
  let fetched = 0;
  let visible = 0;
  while (true) {
    const response = await listNotifications(true, page);
    fetched += response.list.length;
    visible += response.list.filter((notification) => !notification.targetAnonymous).length;
    if (
      response.list.length === 0
      || fetched >= response.total
      || response.list.length < response.pageSize
    ) break;
    page += 1;
  }
  return visible;
}

Page({
  data: {
    user: null as { nickname: string; avatarUrl: string | null; roles: string[] } | null,
    avatarChar: '?',
    currentRole: '',
    roleText: '',
    unreadCount: 0,
    roleOptions: ALL_ROLES,         // 3 个角色入口常量
    myRoles: [] as string[],        // 用户实时拥有的角色（来自 /auth/me）
    switchingRole: '',              // 正在切换中的角色（loading 态）
    anonymousContentEnabled: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const u = app.globalData.user;
    const currentRole = app.globalData.currentRole;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    this.setData({
      user: u,
      avatarChar: u ? u.nickname.slice(0, 1) : '?',
      currentRole,
      roleText: roleLabel(currentRole),
      myRoles: u?.roles ?? [],
      anonymousContentEnabled,
      roleOptions: ALL_ROLES.map((option) => option.key === 'USER'
        ? { ...option, desc: anonymousContentEnabled ? '表白墙 · 树洞 · 兼职' : '表白墙 · 兼职' }
        : option),
    });
    // 后台刷新实时角色权限（静默，不阻塞 UI）
    refreshRoles().then((roles) => {
      if (roles) this.setData({ myRoles: roles });
    });
    try {
      this.setData({
        unreadCount: await countVisibleUnreadNotifications(anonymousContentEnabled),
      });
    } catch {
      this.setData({ unreadCount: 0 });
    }
  },

  // 切换角色：二次确认权限 → switchRole → reLaunch 到目标端首页
  async switchToRole(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as string;
    if (!role || role === this.data.currentRole) return;
    // 不拥有该角色 → toast 提示
    if (!this.data.myRoles.includes(role)) {
      wx.showToast({ title: '暂无该角色权限', icon: 'none' });
      return;
    }
    if (this.data.switchingRole) return;
    this.setData({ switchingRole: role });
    try {
      const app = getApp<AppInstance>();
      // role 来自 wxml data-role={{item.key}}，大写（USER/MERCHANT/ADMIN）；
      // 后端 DTO 仅接受小写，需 toLowerCase，与商家/管理端 onSwitchRole 保持一致
      const roleLower = role.toLowerCase() as 'user' | 'merchant' | 'admin';
      await app.switchRole(roleLower);
      app.routeToRoleHome(roleLower);
    } catch (e: any) {
      const msg = e?.message || '';
      // 服务器返回了具体错误信息（如"商家未通过审核"），request 层已弹 toast，不再重复
      // 仅当错误信息未显示时补 toast
      if (!msg) wx.showToast({ title: '切换失败，请重试', icon: 'none' });
      // 刷新角色状态
      refreshRoles().then((roles) => {
        if (roles) this.setData({ myRoles: roles });
      });
    } finally {
      this.setData({ switchingRole: '' });
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
    if (this.data.anonymousContentEnabled) {
      wx.navigateTo({ url: '/pages/my-anon-posts/index' });
    }
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

  openPrivacyGuide() {
    wx.openPrivacyContract({
      fail: () => {
        wx.showToast({
          title: '暂时无法打开隐私指引',
          icon: 'none',
        });
      },
    });
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
