import type { AppInstance } from '../../../app';

// 管理端底部 tab：审核 / 看板 / 岗位 / 我的
const ADMIN_TABS = [
  { path: '/pages/admin/index', label: '审核' },
  { path: '/pages/admin/index?tab=stats', label: '看板' },
  { path: '/pages/admin/index?tab=jobs', label: '岗位' },
  { path: '/pages/admin/profile/index', label: '我的' },
];

Page({
  data: {
    tabs: ADMIN_TABS,
    current: 'pages/admin/profile/index',
    nickname: '',
    roleText: '管理员',
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const u = app.globalData.user;
    this.setData({
      nickname: u ? u.nickname : '',
      roleText: '管理员',
    });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/index' });
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