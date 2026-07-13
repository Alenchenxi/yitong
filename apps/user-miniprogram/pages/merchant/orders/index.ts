import type { AppInstance } from '../../../app';
import { getMerchantOrders, type MerchantOrderVo } from '../../../services/merchant';

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
});
