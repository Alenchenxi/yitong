import type { AppInstance } from '../../../app';
import { cancelApp, listMyApplications, reportApplication, reviewApp, type JobAppVo } from '../../../services/job';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待处理',
  ACCEPTED: '已录用',
  DONE: '已完成',
  CANCELLED: '已取消',
  REJECTED: '未录用',
};

Page({
  data: {
    apps: [] as Array<JobAppVo & { statusText: string }>,
    reviewAppId: '',
    rating: 5,
    reviewContent: '',
    submitting: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    try {
      const apps = await listMyApplications();
      this.setData({
        apps: apps.map((a) => ({ ...a, statusText: STATUS_TEXT[a.status] ?? a.status })),
      });
    } catch {
      /* toast */
    }
  },

  openReview(e: WechatMiniprogram.TouchEvent) {
    this.setData({
      reviewAppId: e.currentTarget.dataset.id as string,
      rating: 5,
      reviewContent: '',
    });
  },

  cancelReview() {
    this.setData({ reviewAppId: '' });
  },

  pickRating(e: WechatMiniprogram.TouchEvent) {
    this.setData({ rating: Number(e.currentTarget.dataset.r) });
  },

  onReviewInput(e: WechatMiniprogram.Input) {
    this.setData({ reviewContent: e.detail.value });
  },

  async submitReview() {
    if (this.data.submitting) return;
    const { reviewAppId, rating, reviewContent } = this.data;
    if (!reviewContent.trim()) {
      wx.showToast({ title: '请写评价', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await reviewApp(reviewAppId, { rating, content: reviewContent.trim() });
      wx.showToast({ title: '评价成功', icon: 'success' });
      this.setData({ reviewAppId: '' });
      await this.load();
    } catch {
      /* toast */
    } finally {
      this.setData({ submitting: false });
    }
  },

  // P1-23 取消未处理报名：二次确认后调 cancelApp，成功后刷新
  confirmCancel(e: WechatMiniprogram.TouchEvent) {
    const appId = e.currentTarget.dataset.id as string;
    if (!appId) return;
    wx.showModal({
      title: '取消报名',
      content: '确认取消此报名？取消后商家将收到通知。',
      confirmText: '确认取消',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await cancelApp(appId);
          wx.showToast({ title: '已取消', icon: 'success' });
          await this.load();
        } catch {
          /* toast */
        }
      },
    });
  },

  // P1-27 学生投诉商家（针对该报名）
  onReport(e: WechatMiniprogram.TouchEvent) {
    const appId = e.currentTarget.dataset.id as string;
    if (!appId) return;
    wx.showModal({
      title: '投诉商家',
      editable: true,
      placeholderText: '选填：投诉原因（如拖欠薪资/岗位不符）',
      confirmText: '投诉',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await reportApplication(appId, res.content || undefined);
          wx.showToast({ title: '已投诉，平台将核实', icon: 'success' });
        } catch {
          /* toast */
        }
      },
    });
  },
});
