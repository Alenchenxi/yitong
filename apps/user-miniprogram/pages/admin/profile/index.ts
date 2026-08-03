import type { AppInstance } from '../../../app';

// 管理端底部 tab：看板 / 审核 / 运营 / 用户 / 我的
const ADMIN_TABS = [
  { path: '/pages/admin/dashboard/index', label: '看板' },
  { path: '/pages/admin/review/index', label: '审核' },
  { path: '/pages/admin/ops/index', label: '运营' },
  { path: '/pages/admin/users/index', label: '用户' },
  { path: '/pages/admin/profile/index', label: '我的' },
];

Page({
  data: {
    tabs: ADMIN_TABS,
    current: 'pages/admin/profile/index',
    nickname: '',
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const u = app.globalData.user;
    this.setData({ nickname: u ? u.nickname : '' });
  },

  // 快捷入口：跳到其他管理页
  go(e: WechatMiniprogram.TouchEvent) {
    const url = e.currentTarget.dataset.url as string;
    if (url) wx.reLaunch({ url });
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
});
