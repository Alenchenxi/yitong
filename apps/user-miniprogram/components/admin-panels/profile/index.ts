import type { AppInstance } from '../../../app';

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
  },

  methods: {
    onParams(_params: Record<string, unknown>) {
      // profile 无需外部参数（shell 注入的 query 在此接收）
    },

    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      const u = app.globalData.user;
      this.setData({ nickname: u ? u.nickname : '' });
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
