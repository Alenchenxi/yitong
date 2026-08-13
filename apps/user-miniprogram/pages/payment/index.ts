import type { AppInstance } from '../../app';
import { getJobPublishPricing, publishJob, syncOrderStatus, type PublishOrderVo, type JobPublishPriceVo } from '../../services/payment';

Page({
  data: {
    jobPostId: '',
    selectedDuration: 'D30' as 'D30' | 'D90',
    price: { D30: 0, D90: 0 } as Record<'D30' | 'D90', number>,
    perDayPrice: { D30: '0.00', D90: '0.00' } as Record<'D30' | 'D90', string>,
    currentPrice: '',
    noticeOpen: false,
    paying: false,
    result: null as PublishOrderVo | null,
    failed: false,
    message: '',
  },

  onLoad(options: { jobPostId?: string; duration?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const duration = (options.duration as 'D30' | 'D90') ?? 'D30';
    this.setData({
      jobPostId: options.jobPostId ?? '',
      selectedDuration: duration,
    });
    this.loadPrice();
  },

  // 抓两档价格(按当前 PricingConfig 真值填充,失败用 0 占位)
  async loadPrice() {
    try {
      const list: JobPublishPriceVo[] = await getJobPublishPricing();
      const out = { D30: 0, D90: 0 } as Record<'D30' | 'D90', number>;
      list.forEach((p) => {
        if (p && (p.duration === 'D30' || p.duration === 'D90')) out[p.duration] = Number(p.price) || 0;
      });
      const perDay = {
        D30: out.D30 > 0 ? (out.D30 / 30).toFixed(2) : '0.00',
        D90: out.D90 > 0 ? (out.D90 / 90).toFixed(2) : '0.00',
      } as Record<'D30' | 'D90', string>;
      this.setData({
        price: out,
        perDayPrice: perDay,
        currentPrice: String(out[this.data.selectedDuration]),
      });
    } catch {
      /* 价格预览失败不阻塞支付 */
    }
  },

  // 切换套餐档(月卡 30 / 季卡 90)
  onPickDuration(e: WechatMiniprogram.TouchEvent) {
    const d = e.currentTarget.dataset.d as 'D30' | 'D90';
    this.setData({
      selectedDuration: d,
      currentPrice: String(this.data.price[d]),
    });
  },

  // 切换购买须知折叠
  toggleNotice() {
    this.setData({ noticeOpen: !this.data.noticeOpen });
  },

  // 立即支付
  async onPay() {
    if (this.data.paying || !this.data.jobPostId) return;
    this.setData({ paying: true, failed: false, message: '' });
    try {
      const result = await publishJob({
        jobPostId: this.data.jobPostId,
        duration: this.data.selectedDuration,
      });
      // dev mock:直接完成,无 wxPayParams
      if (!result.wxPayParams) {
        this.setData({ result });
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => wx.reLaunch({ url: '/pages/merchant/index?tab=jobs' }), 1200);
        return;
      }
      // 生产:拉起微信支付
      this.setData({ result });
      try {
        await this.requestPay(result.wxPayParams);
      } catch {
        this.setData({ failed: true, message: '支付未完成,可稍后在订单页刷新状态' });
        wx.showToast({ title: '支付未完成', icon: 'none' });
        return;
      }
      // 支付成功后调 sync 兜底
      try {
        const synced = await syncOrderStatus(result.orderId);
        this.setData({
          result: { ...result, status: synced.status, jobPostStatus: synced.status === 'PAID' ? 'PUBLISHED' : result.jobPostStatus },
          message: synced.message,
        });
        if (synced.status === 'PAID') {
          wx.showToast({ title: '支付成功', icon: 'success' });
          setTimeout(() => wx.reLaunch({ url: '/pages/merchant/index?tab=jobs' }), 1200);
        } else {
          wx.showToast({ title: synced.message || '支付确认中', icon: 'none' });
        }
      } catch {
        this.setData({ message: '支付成功,状态确认中' });
        wx.showToast({ title: '支付成功,状态确认中', icon: 'none' });
      }
    } catch (e) {
      const msg = (e as { message?: string })?.message || '提交失败';
      wx.showModal({ title: '支付失败', content: msg, showCancel: false, confirmText: '我知道了' });
    } finally {
      this.setData({ paying: false });
    }
  },

  // 兼容旧模板引用 pay()
  pay() {
    return this.onPay();
  },

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
