import type { AppInstance } from '../../app';
import { getJobPublishPricing, publishJob, syncOrderStatus, type PublishOrderVo } from '../../services/payment';

Page({
  data: {
    jobPostId: '',
    duration: 'D30',
    price: '',
    paying: false,
    result: null as PublishOrderVo | null,
    failed: false,
    message: '',
  },

  onLoad(options: { jobPostId?: string; duration?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.setData({
      jobPostId: options.jobPostId ?? '',
      duration: (options.duration as 'D30' | 'D90') ?? 'D30',
    });
    this.loadPrice();
  },

  // 预览发布单价（按当前 duration 取 PricingConfig 价格）；失败不阻塞，支付时仍按服务端算
  async loadPrice() {
    try {
      const list = await getJobPublishPricing();
      const p = list.find((x) => x.duration === this.data.duration);
      if (p) this.setData({ price: p.price });
    } catch {
      /* 价格预览失败不阻塞支付 */
    }
  },

  async pay() {
    if (this.data.paying || !this.data.jobPostId) return;
    this.setData({ paying: true, failed: false, message: '' });
    try {
      const result = await publishJob({
        jobPostId: this.data.jobPostId,
        duration: this.data.duration as 'D30' | 'D90',
      });
      // dev mock：直接完成，无 wxPayParams
      if (!result.wxPayParams) {
        this.setData({ result });
        wx.showToast({ title: '支付成功', icon: 'success' });
        return;
      }
      // 生产：拉起微信支付
      this.setData({ result });
      try {
        await this.requestPay(result.wxPayParams);
      } catch {
        // 仅 wx.requestPayment 失败才算未完成
        this.setData({ failed: true, message: '支付未完成，可稍后在订单页刷新状态' });
        wx.showToast({ title: '支付未完成', icon: 'none' });
        return;
      }
      // 支付成功后调 sync 兜底确认（回调可能未到，sync 直查微信）
      try {
        const synced = await syncOrderStatus(result.orderId);
        this.setData({ result: { ...result, status: synced.status, jobPostStatus: synced.status === 'PAID' ? 'PUBLISHED' : result.jobPostStatus }, message: synced.message });
        if (synced.status === 'PAID') {
          wx.showToast({ title: '支付成功', icon: 'success' });
        } else {
          wx.showToast({ title: synced.message || '支付确认中', icon: 'none' });
        }
      } catch {
        // 支付已成功，仅同步失败：回调会兜底完成
        this.setData({ message: '支付成功，状态确认中' });
        wx.showToast({ title: '支付成功，状态确认中', icon: 'none' });
      }
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ paying: false });
    }
  },

  // 包装 wx.requestPayment 为 Promise
  requestPay(params: NonNullable<PublishOrderVo['wxPayParams']>): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.requestPayment({
        timeStamp: params.timeStamp,
        nonceStr: params.nonceStr,
        package: params.package,
        signType: params.signType,
        paySign: params.paySign,
        success: () => resolve(),
        fail: (e) => reject(e),
      });
    });
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/merchant/orders/index' });
  },

  goBack() {
    wx.navigateBack();
  },
});
