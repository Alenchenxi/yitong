import type { AppInstance } from '../../app';
import { listBoostPlans, createBoostOrder, type BoostPlanVo, type BoostOrderVo } from '../../services/boost';
import { syncOrderStatus, type VirtualPayParams } from '../../services/payment';

// 内容推广（付费置顶曝光）页：选档 -> 下单 ->（dev mock 直成 / 生产 wx.requestVirtualPayment）
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
      // dev mock：直接完成，无 virtualPayParams
      if (!result.virtualPayParams) {
        wx.showToast({ title: '推广成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      // 生产：拉起虚拟支付（道具直购）
      try {
        await this.requestVirtualPay(result.virtualPayParams);
        // 微信侧成功即视为支付成功；syncOrderStatus 兜底对账（发货确认由后端推送/轮询收敛）
        await syncOrderStatus(result.orderId).catch(() => undefined);
        wx.showToast({ title: '推广成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      } catch {
        let message = '支付未完成，可稍后重试（持续失败请重进小程序）';
        try {
          const synced = await syncOrderStatus(result.orderId);
          message = synced.message || message;
          this.setData({ result: { ...result, status: synced.status } });
        } catch {
          // 微信取消后可能暂未返回最终状态，保留订单供后续重试复用。
        }
        this.setData({ failed: true, message });
        wx.showToast({ title: '支付未完成', icon: 'none' });
      }
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ paying: false });
    }
  },

  // 虚拟支付拉起：三要素原样透传（signData 禁止重新序列化），发货确认由后端消息推送或上方 sync 兜底
  requestVirtualPay(params: VirtualPayParams): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.requestVirtualPayment({
        signData: params.signData,
        paySig: params.paySig,
        signature: params.signature,
        mode: params.mode,
        success: () => resolve(),
        fail: (e) => reject(e),
      });
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
