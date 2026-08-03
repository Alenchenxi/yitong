import type { AppInstance } from '../../app';

// 消息页薄壳：列表逻辑在 components/notifications-view，宿主 onShow/onReady 调 refresh
Page({
  onShow() {
    const v = this.selectComponent('#nv') as { refresh?: () => void } | null;
    if (v?.refresh) v.refresh();
  },
  onReady() {
    // 首次渲染完成 notifications-view 已 attached，补一次刷新（onShow 时可能尚未 attached）
    const v = this.selectComponent('#nv') as { refresh?: () => void } | null;
    if (v?.refresh) v.refresh();
  },
  // 报名处理提醒 -> 商家 shell 候选人 tab（merchant_candidates 是商家通知；用户端薄壳理论上不触发，防御性处理）
  onOpenCandidates() {
    const app = getApp<AppInstance>();
    if (app.globalData.currentRole === 'merchant') {
      wx.reLaunch({ url: '/pages/merchant/index?tab=candidates' });
    }
  },
});
