import type { AppInstance } from '../../app';
import { publishJob, type PublishOrderVo } from '../../services/payment';

Page({
  data: {
    jobPostId: '',
    duration: 'D30',
    paying: false,
    result: null as PublishOrderVo | null,
  },

  onLoad(options: { jobPostId?: string; duration?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.setData({
      jobPostId: options.jobPostId ?? '',
      duration: (options.duration as 'D30' | 'D90') ?? 'D30',
    });
  },

  async pay() {
    if (this.data.paying || !this.data.jobPostId) return;
    this.setData({ paying: true });
    try {
      const result = await publishJob({
        jobPostId: this.data.jobPostId,
        duration: this.data.duration as 'D30' | 'D90',
      });
      this.setData({ result });
      wx.showToast({ title: '支付成功', icon: 'success' });
    } catch {
      /* toast 已弹 */
    } finally {
      this.setData({ paying: false });
    }
  },

  goBack() {
    wx.navigateBack();
  },
});
