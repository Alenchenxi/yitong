import type { AppInstance } from '../../../app';
import { listMyApplications, reviewApp, type JobAppVo } from '../../../services/job';

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
});
