import type { AppInstance } from '../../app';
import { listNotifications } from '../../services/notification';
import { refreshRoles, ALL_ROLES, type RoleOption } from '../../services/auth';
import { profileRoleText } from '../../utils/auth';
import { syncCustomTabBar } from '../../utils/custom-tabbar';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';
import {
  bindJobModuleVisibility,
  unbindJobModuleVisibility,
} from '../../utils/job-module';

// P2-72 切换角色入口格子：实时权限渲染（与管理端 profile panel 同口径）
// guide=true 为「去入驻」引导态（未入驻商家，点击进商家端由 shell 探测跳入驻页）
interface RoleCell extends RoleOption {
  guide: boolean;
}

// 用户角色描述随两个平台开关变化（树洞受匿名内容开关、兼职受兼职板块开关控制）
function userRoleDesc(anonymousContentEnabled: boolean, jobModuleEnabled: boolean): string {
  const parts = ['表白墙'];
  if (anonymousContentEnabled) parts.push('树洞');
  if (jobModuleEnabled) parts.push('兼职');
  return parts.join(' · ');
}

// P2-72 按实时权限构建切换格子：USER 恒显（人人拥有）；MERCHANT 未入驻显示「去入驻」
// 引导；ADMIN 仅实时拥有时显示（后台加/删管理员，回到本页随 refreshRoles 出现/消失）
function buildRoleCells(
  myRoles: string[],
  anonymousContentEnabled: boolean,
  jobModuleEnabled: boolean,
): RoleCell[] {
  return ALL_ROLES.filter(
    (option) =>
      option.key !== 'ADMIN' || myRoles.includes('ADMIN'),
  ).map((option) => ({
    ...option,
    desc: option.key === 'USER'
      ? userRoleDesc(anonymousContentEnabled, jobModuleEnabled)
      : option.desc,
    guide: option.key === 'MERCHANT' && !myRoles.includes('MERCHANT'),
  }));
}

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
    roleOptions: buildRoleCells([], false, false), // P2-72 实时权限渲染，onShow 按缓存/实时 roles 重算
    myRoles: [] as string[],        // 用户实时拥有的角色（来自 /auth/me）
    switchingRole: '',              // 正在切换中的角色（loading 态）
    anonymousContentEnabled: false,
    jobModuleEnabled: false,
  },

  onLoad() {
    bindAnonymousContentVisibility(this, (enabled) => {
      this.updateAnonymousContentVisibility(enabled);
    });
    bindJobModuleVisibility(this, (enabled) => {
      this.updateJobModuleVisibility(enabled);
    });
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
    unbindJobModuleVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    this.setData({
      anonymousContentEnabled: enabled,
      roleOptions: buildRoleCells(this.data.myRoles, enabled, this.data.jobModuleEnabled),
    });
  },

  updateJobModuleVisibility(enabled: boolean) {
    this.setData({
      jobModuleEnabled: enabled,
      roleOptions: buildRoleCells(this.data.myRoles, this.data.anonymousContentEnabled, enabled),
    });
  },

  async onShow() {
    syncCustomTabBar(this, '/pages/profile/index');
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const u = app.globalData.user;
    const currentRole = app.globalData.currentRole;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    this.updateAnonymousContentVisibility(anonymousContentEnabled);
    const jobModuleEnabled = await app.getJobModuleVisibility();
    this.updateJobModuleVisibility(jobModuleEnabled);
    this.setData({
      user: u,
      avatarChar: u ? u.nickname.slice(0, 1) : '?',
      currentRole,
    });
    // P2-72 徽章/切换格子统一走 applyRoles（含 roleOptions 实时权限重算）
    this.applyRoles(u?.roles ?? []);
    // 后台刷新实时角色权限（静默，不阻塞 UI）；refreshRoles 已同步 adminTypeName 进 globalData
    refreshRoles().then((roles) => {
      if (roles) this.applyRoles(roles);
    });
    try {
      this.setData({
        unreadCount: await countVisibleUnreadNotifications(anonymousContentEnabled),
      });
    } catch {
      this.setData({ unreadCount: 0 });
    }
  },

  // P2-72 刷新角色后同步徽章与切换格子（refreshRoles 已把最新 adminTypeName 写回 globalData.user）
  applyRoles(roles: string[]) {
    const app = getApp<AppInstance>();
    this.setData({
      myRoles: roles,
      roleText: profileRoleText(roles, app.globalData.user?.adminTypeName),
      roleOptions: buildRoleCells(roles, this.data.anonymousContentEnabled, this.data.jobModuleEnabled),
    });
  },

  // 切换角色：二次确认权限 → switchRole → reLaunch 到目标端首页
  async switchToRole(e: WechatMiniprogram.TouchEvent) {
    const role = e.currentTarget.dataset.role as string;
    if (!role || role === this.data.currentRole) return;
    // P2-72 未入驻商家格：去入驻引导（统一进商家 shell，未入驻由 shell 探测跳入驻）
    const cell = this.data.roleOptions.find((c) => c.key === role);
    if (cell?.guide) {
      this.goMerchant();
      return;
    }
    // 不拥有该角色 → toast 提示（refreshRoles 未回/缓存过期的时序兜底）
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
        if (roles) this.applyRoles(roles);
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
