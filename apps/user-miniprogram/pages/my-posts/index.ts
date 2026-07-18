import type { AppInstance } from '../../app';
import { listMyPosts, type PostVo } from '../../services/confession';
import { formatTime } from '../../utils/auth';

Page({
  data: { posts: [] as Array<PostVo & { timeText: string }>, loading: true },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    try {
      const r = await listMyPosts();
      this.setData({ posts: r.list.map((p) => ({ ...p, timeText: formatTime(p.createdAt) })) });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },
});
