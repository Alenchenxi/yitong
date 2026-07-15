import type { AppInstance } from '../../../app';
import { getMerchantOrders, type MerchantOrderVo } from '../../../services/merchant';
import { refundPayment } from '../../../services/payment';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待支付', PAID: '已支付', REFUNDED: '已退款', CLOSED: '已关闭',
};

Page({
  data: { orders: [] as (MerchantOrderVo & { statusText: string })[], loading: false },

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

  onRefund(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.showModal({
      title: '申请退款',
      content: '退款后对应岗位会下架，确认继续？',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await refundPayment(id, '商家主动申请退款');
          wx.showToast({ title: '已退款', icon: 'success' });
          this.load();
        } catch {
          wx.showToast({ title: '退款失败', icon: 'none' });
        }
      },
    });
  },
});
