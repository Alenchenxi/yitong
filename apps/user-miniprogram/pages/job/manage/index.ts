import type { AppInstance } from '../../../app';
import { listJobPosts, type JobPostVo } from '../../../services/job';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待发布',
  PUBLISHED: '已发布',
  TAKEN_DOWN: '已下架',
  EXPIRED: '已过期',
};

Page({
  data: {
    posts: [] as Array<JobPostVo & { statusText: string }>,
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    try {
      const resp = await listJobPosts(undefined, true);
      this.setData({
        posts: resp.list.map((p) => ({ ...p, statusText: STATUS_TEXT[p.status] ?? p.status })),
      });
    } catch {
      /* toast */
    }
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },

  goPay(e: WechatMiniprogram.TouchEvent) {
    const { id, dur } = e.currentTarget.dataset as { id: string; dur: string };
    wx.navigateTo({ url: `/pages/payment/index?jobPostId=${id}&duration=${dur}` });
  },
});
