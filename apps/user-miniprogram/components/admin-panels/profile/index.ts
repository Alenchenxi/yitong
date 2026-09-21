import type { AppInstance } from '../../../app';
import { refreshRoles } from '../../../services/auth';
import { profileRoleText } from '../../../utils/auth';

// 管理端「我的」panel（由 pages/admin/index shell 保活装载）
Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    params: {
      type: Object,
      value: {},
      observer(n) {
        this.onParams((n || {}) as Record<string, unknown>);
      },
    },
  },

  data: {
    nickname: '',
    // 身份徽章：与用户端「我的」页同一 profileRoleText 口径（ADMIN 角色显具体管理员类型名）
    roleText: '管理员',
    // role switching
    currentRole: '',
    myRoles: [] as string[],
    switchingRole: '',
  },

  methods: {
    onParams(_params: Record<string, unknown>) {},

    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      const u = app.globalData.user;
      this.setData({
        nickname: u ? u.nickname : '',
        currentRole: app.globalData.currentRole,
        roleText: profileRoleText(u?.roles ?? [], u?.adminTypeName),
        myRoles: u?.roles ?? [],
      });
      this.loadRoles();
    },

    async loadRoles() {
      try {
        const roles = await refreshRoles();
        if (roles) this.applyRoles(roles);
      } catch {
        const app = getApp<AppInstance>();
        if (app.globalData.user) this.applyRoles(app.globalData.user.roles);
      }
    },

    // 刷新角色后同步徽章与切换列表（refreshRoles 已把最新 adminTypeName 写回 globalData.user）
    applyRoles(roles: string[]) {
      const app = getApp<AppInstance>();
      this.setData({
        myRoles: roles,
        roleText: profileRoleText(roles, app.globalData.user?.adminTypeName),
      });
    },

    async onSwitchRole(e: WechatMiniprogram.TouchEvent) {
      const role = e.currentTarget.dataset.role as string;
      if (!role || role === this.data.currentRole || this.data.switchingRole) return;
      if (!this.data.myRoles.includes(role)) {
        wx.showToast({ title: '暂无该角色权限', icon: 'none' });
        return;
      }
      this.setData({ switchingRole: role });
      try {
        const app = getApp<AppInstance>();
        await app.switchRole(role.toLowerCase() as 'user' | 'merchant' | 'admin');
        app.routeToRoleHome(role.toLowerCase());
      } catch {
        refreshRoles().then((roles) => { if (roles) this.applyRoles(roles); });
      } finally {
        this.setData({ switchingRole: '' });
      }
    },

    onPanelReachBottom() {
      // profile 无分页列表
    },

    onPanelPullDown() {
      wx.stopPullDownRefresh();
    },

    // 快捷入口：切到其他管理端 tab（同端 tab 跳转走 switchtab，由 shell 切换）
    go(e: WechatMiniprogram.TouchEvent) {
      const tab = e.currentTarget.dataset.tab as string;
      if (tab) this.triggerEvent('switchtab', { tab });
    },

    goAccountSecurity() {
      wx.navigateTo({ url: '/pages/account-security/index' });
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
  },
});
