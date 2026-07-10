import type { AppInstance } from '../../../app';
import {
  getMerchantProfile,
  updateMerchantProfile,
  type MerchantVo,
} from '../../../services/merchant';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '审核中',
  APPROVED: '已通过',
  REJECTED: '未通过',
};

Page({
  data: {
    merchant: null as MerchantVo | null,
    statusText: '',
    editing: false,
    shopName: '',
    contactPhone: '',
    saving: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.load();
  },

  async load() {
    try {
      const m = await getMerchantProfile();
      this.setData({
        merchant: m,
        statusText: STATUS_TEXT[m.status] || m.status,
        shopName: m.shopName,
        contactPhone: m.contactPhone,
      });
    } catch {
      // 未入驻，跳入驻页
      wx.redirectTo({ url: '/pages/merchant/register/index' });
    }
  },

  toggleEdit() {
    this.setData({ editing: !this.data.editing });
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'shopName' | 'contactPhone';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const m = await updateMerchantProfile({
        shopName: this.data.shopName,
        contactPhone: this.data.contactPhone,
      });
      this.setData({ merchant: m, editing: false });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ saving: false });
    }
  },
});
