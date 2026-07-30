import type { AppInstance } from '../../../app';
import {
  getMerchantProfile,
  type MerchantVo,
} from '../../../services/merchant';
import { listNotifications } from '../../../services/notification';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '审核中',
  APPROVED: '已认证',
  REJECTED: '未通过',
};

Page({
  data: {
    merchant: null as MerchantVo | null,
    statusText: '',
    notMerchant: false, // 未入驻
    editing: false,
    shopName: '',
    contactPhone: '',
    saving: false,
    unreadCount: 0,
    currentRole: '',
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.setData({ currentRole: app.globalData.currentRole });
    this.load();
    this.loadUnread();
  },

  async load() {
    try {
      const m = await getMerchantProfile();
      this.setData({
        merchant: m,
        statusText: STATUS_TEXT[m.status] || m.status,
        shopName: m.shopName,
        contactPhone: m.contactPhone,
        notMerchant: false,
      });
    } catch {
      // 未入驻
      this.setData({ notMerchant: true, merchant: null });
    }
  },

  async loadUnread() {
    try {
      const resp = await listNotifications(false, 1);
      this.setData({ unreadCount: resp.unreadCount });
    } catch {
      this.setData({ unreadCount: 0 });
    }
  },

  toggleEdit() {
    if (!this.data.merchant) return;
    this.setData({
      editing: !this.data.editing,
      shopName: this.data.merchant.shopName,
      contactPhone: this.data.merchant.contactPhone,
    });
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as 'shopName' | 'contactPhone';
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const { updateMerchantProfile } = await import('../../../services/merchant');
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

  // M5-01 商家工作台菜单（仅平台内功能，不展示不做项）
  goJobs() {
    wx.navigateTo({ url: '/pages/job/manage/index' });
  },
  goCandidates() {
    wx.navigateTo({ url: '/pages/candidates/index' });
  },
  goPostJob() {
    wx.navigateTo({ url: '/pages/job/post/index' });
  },
  goOrders() {
    wx.navigateTo({ url: '/pages/merchant/orders/index' });
  },
  goReviews() {
    wx.navigateTo({ url: '/pages/merchant/reviews/index' });
  },
  goDashboard() {
    wx.navigateTo({ url: '/pages/merchant/dashboard/index' });
  },
  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/index' });
  },
  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/index' });
  },
  goRegister() {
    wx.navigateTo({ url: '/pages/merchant/register/index' });
  },
  goAccountSecurity() {
    wx.navigateTo({ url: '/pages/account-security/index' });
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
