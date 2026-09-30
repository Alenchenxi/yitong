import type { AppInstance } from '../../../app';
import { getMerchantOrders, type MerchantOrderVo } from '../../../services/merchant';
import { syncOrderStatus } from '../../../services/payment';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待支付', PAID: '已支付', REFUNDING: '退款中', REFUNDED: '已退款', CLOSED: '已关闭',
};

type OrderRow = MerchantOrderVo & { statusText: string };

Page({
  data: { orders: [] as OrderRow[], loading: false },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const orders = await getMerchantOrders();
      this.setData({ orders: orders.map(o => ({ ...o, statusText: STATUS_TEXT[o.status] ?? o.status })) });
    } catch {} finally { this.setData({ loading: false }); }
  },

  // M6-05 兜底刷新：按微信真实状态对账本地
  async onSync(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.showLoading({ title: '刷新中…' });
    try {
      const res = await syncOrderStatus(id);
      wx.hideLoading();
      wx.showToast({ title: res.message || '已刷新', icon: 'none' });
      this.load();
    } catch {
      wx.hideLoading();
      wx.showToast({ title: '刷新失败', icon: 'none' });
    }
  },
});
