import type { AppInstance } from '../../../app';
import { listJobPosts, type JobPostVo } from '../../../services/job';
import { getMerchantProfile } from '../../../services/merchant';

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
    settled: false, // 入驻探测完成（已入驻 true / 未入驻将跳走）
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 商家首页：未入驻直接跳入驻页（getMerchantProfile 未入驻抛 60002）
    getMerchantProfile()
      .then(() => {
        this.setData({ settled: true });
        this.load();
      })
      .catch(() => {
        wx.redirectTo({ url: '/pages/merchant/register/index' });
      });
  },

  onShow() {
    if (this.data.settled) this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const resp = await listJobPosts({ mine: true });
      this.setData({
        posts: resp.list.map((p) => ({ ...p, statusText: STATUS_TEXT[p.status] ?? p.status })),
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
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
