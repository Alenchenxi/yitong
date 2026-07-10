import type { AppInstance } from '../../app';
import { listJobPosts, type JobPostVo } from '../../services/job';

Page({
  data: {
    posts: [] as JobPostVo[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    isMerchant: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const isMerchant = app.globalData.currentRole === 'MERCHANT';
    this.setData({ isMerchant });
    if (this.data.posts.length === 0) this.reload();
  },

  async reload() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const resp = await listJobPosts(this.data.nextCursor ?? undefined, false);
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.reload();
  },

  onReachBottom() {
    this.loadMore();
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },

  goPost() {
    wx.navigateTo({ url: '/pages/job/post/index' });
  },

  goManage() {
    wx.navigateTo({ url: '/pages/job/manage/index' });
  },

  goMyApps() {
    wx.navigateTo({ url: '/pages/job/my-applications/index' });
  },
});
