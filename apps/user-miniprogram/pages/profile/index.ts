import type { AppInstance } from '../../app';

interface ProfileData {
  user: { nickname: string; avatarUrl: string | null; role: string } | null;
  avatarChar: string;
}

Page({
  data: {
    user: null,
    avatarChar: '?',
  } as ProfileData,

  async onShow() {
    const app = getApp<AppInstance>();
    try {
      await app.waitLogin();
    } catch {
      return;
    }
    const u = app.globalData.user;
    this.setData({
      user: u,
      avatarChar: u ? u.nickname.slice(0, 1) : '?',
    });
  },

  goMyPosts() {
    wx.showToast({ title: '开发中', icon: 'none' });
  },
});
