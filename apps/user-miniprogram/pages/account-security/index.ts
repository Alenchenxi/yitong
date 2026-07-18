import type { AppInstance } from '../../app';
import { getAccount, updateAccount, deleteAccount } from '../../services/account';

const GENDERS = ['male', 'female', 'other'];

Page({
  data: {
    nickname: '',
    genderLabels: ['男', '女', '其他'],
    genderIndex: -1,
    birthday: '',
    saving: false,
    showCancel: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    try {
      const a = await getAccount();
      const gi = a.gender ? GENDERS.indexOf(a.gender) : -1;
      this.setData({ nickname: a.nickname, genderIndex: gi, birthday: a.birthday ?? '' });
    } catch {
      /* toast */
    }
  },

  onNickname(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value });
  },
  onGenderChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },
  onBirthdayChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ birthday: e.detail.value as string });
  },

  async save() {
    if (this.data.saving) return;
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await updateAccount({
        nickname: this.data.nickname.trim(),
        gender: this.data.genderIndex >= 0 ? GENDERS[this.data.genderIndex] : undefined,
        birthday: this.data.birthday || undefined,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch {
      /* toast */
    } finally {
      this.setData({ saving: false });
    }
  },

  onChangePassword() {
    wx.showToast({ title: '微信登录无需密码', icon: 'none' });
  },

  openCancel() {
    this.setData({ showCancel: true });
  },
  closeCancel() {
    this.setData({ showCancel: false });
  },
  async confirmCancel() {
    try {
      await deleteAccount();
      wx.showToast({ title: '已申请注销', icon: 'success' });
      getApp<AppInstance>().logout();
    } catch {
      /* toast */
    }
  },
});
