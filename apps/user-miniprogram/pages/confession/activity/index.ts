import type { AppInstance } from '../../../app';
import { listActivityTopics, type ActivityTopicVo } from '../../../services/confession';

Page({
  data: {
    topics: [] as ActivityTopicVo[],
    loading: false,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const topics = await listActivityTopics();
      this.setData({ topics });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.load();
  },

  goTopic(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/confession/activity-detail/index?id=${id}` });
  },
});
