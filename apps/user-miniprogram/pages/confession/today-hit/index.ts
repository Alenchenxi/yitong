import type { AppInstance } from '../../../app';
import { listTodayHit, toggleLike, type PostVo } from '../../../services/confession';

Page({
  data: {
    posts: [] as PostVo[],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    hasMore: true,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.reload();
  },

  async reload() {
    this.setData({ posts: [], page: 1, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const resp = await listTodayHit(this.data.page, this.data.pageSize);
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        total: resp.total,
        page: this.data.page + 1,
        hasMore: this.data.posts.length + resp.list.length < resp.total,
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

  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    const idx = this.data.posts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const p = this.data.posts[idx];
    const nextLiked = !p.liked;
    const nextCount = p.likeCount + (nextLiked ? 1 : -1);
    this.setData({
      [`posts[${idx}].liked`]: nextLiked,
      [`posts[${idx}].likeCount`]: Math.max(0, nextCount),
    });
    try {
      await toggleLike(id);
    } catch {
      this.setData({
        [`posts[${idx}].liked`]: p.liked,
        [`posts[${idx}].likeCount`]: p.likeCount,
      });
    }
  },

  // 转发给微信好友：post-card 转发按钮触发（data-id 定位），无 id 时 fallback 本页
  onShareAppMessage(e: { target?: { dataset?: { id?: string } } }) {
    const id = e?.target?.dataset?.id ?? '';
    return {
      title: '今日上头 · 表白墙',
      path: id ? `/pages/post-detail/index?id=${id}` : '/pages/confession/today-hit/index',
    };
  },
});
