import type { AppInstance } from '../../app';
import { listBoostPlans, createBoostOrder, type BoostPlanVo, type BoostOrderVo } from '../../services/boost';
import type { WxPayParams } from '../../services/payment';

// 内容推广（付费置顶曝光）页：选档 -> 下单 ->（dev mock 直成 / 生产 wx.requestPayment）
Page({
  data: {
    targetType: 'post',
    targetId: '',
    plans: [] as BoostPlanVo[],
    selectedCode: '',
    paying: false,
    result: null as BoostOrderVo | null,
    failed: false,
    message: '',
  },

  async onLoad(options: { type?: string; id?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (options.type === 'anon_post' && !await app.getAnonymousContentVisibility()) {
      wx.switchTab({ url: '/pages/square/index' });
      return;
    }
    this.setData({
      targetType: options.type === 'anon_post' ? 'anon_post' : 'post',
      targetId: options.id ?? '',
    });
    this.loadPlans();
  },

  async loadPlans() {
    try {
      const plans = await listBoostPlans();
      this.setData({ plans, selectedCode: plans[0]?.code ?? '' });
    } catch {
      /* toast 已弹 */
    }
  },

  selectPlan(e: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedCode: e.currentTarget.dataset.code as string });
  },

  async pay() {
    if (this.data.paying || !this.data.selectedCode || !this.data.targetId) return;
    this.setData({ paying: true, failed: false, message: '' });
    try {
      const result = await createBoostOrder({
        targetType: this.data.targetType as 'post' | 'anon_post',
        targetId: this.data.targetId,
        planCode: this.data.selectedCode,
      });
      this.setData({ result });
      // dev mock：直接完成，无 wxPayParams
      if (!result.wxPayParams) {
        wx.showToast({ title: '推广成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      // 生产：拉起微信支付
      try {
        await this.requestPay(result.wxPayParams);
        wx.showToast({ title: '推广成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      } catch {
        this.setData({ failed: true, message: '支付未完成，可稍后重试' });
        wx.showToast({ title: '支付未完成', icon: 'none' });
      }
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ paying: false });
    }
  },

  requestPay(params: WxPayParams): Promise<void> {
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

  goBack() {
    wx.navigateBack();
  },
});
