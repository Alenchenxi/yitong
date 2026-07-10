import type { AppInstance } from '../../../app';
import { createJobPost } from '../../../services/job';

Page({
  data: {
    title: '',
    description: '',
    salary: '',
    location: '',
    duration: 'D30',
    submitting: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as string;
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  pickDuration(e: WechatMiniprogram.TouchEvent) {
    this.setData({ duration: e.currentTarget.dataset.d as 'D30' | 'D90' });
  },

  async submit() {
    if (this.data.submitting) return;
    const { title, description, salary, location, duration } = this.data;
    if (!title.trim() || !description.trim() || !salary.trim() || !location.trim()) {
      wx.showToast({ title: '请填完整', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const post = await createJobPost({
        title: title.trim(),
        description: description.trim(),
        salary: salary.trim(),
        location: location.trim(),
        duration: duration as 'D30' | 'D90',
      });
      wx.showToast({ title: '创建成功', icon: 'success' });
      // 创建为草稿，跳付费发布（feat/payment）
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/payment/index?jobPostId=${post.id}&duration=${duration}` });
      }, 600);
    } catch {
      /* toast */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
