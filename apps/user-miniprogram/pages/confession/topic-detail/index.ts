import type { AppInstance } from '../../../app';
import { getTopic, toggleLike, type PostVo } from '../../../services/confession';

Page({
  data: {
    topic: null as { id: string; name: string; description: string | null } | null,
    posts: [] as PostVo[],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loading: false,
  },
  topicId: '',

  onLoad(options: { id?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.topicId = options.id;
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.topicId && this.data.posts.length === 0) await this.reload();
  },

  async reload() {
    this.setData({ posts: [], page: 1, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const r = await getTopic(this.topicId, this.data.page, this.data.pageSize);
      this.setData({
        topic: r.topic,
        posts: [...this.data.posts, ...r.posts.list],
        total: r.posts.total,
        page: this.data.page + 1,
        hasMore: this.data.posts.length + r.posts.list.length < r.posts.total,
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
    this.setData({
      [`posts[${idx}].liked`]: nextLiked,
      [`posts[${idx}].likeCount`]: Math.max(0, p.likeCount + (nextLiked ? 1 : -1)),
    });
    try {
      await toggleLike(id);
    } catch {
      this.setData({ [`posts[${idx}].liked`]: p.liked, [`posts[${idx}].likeCount`]: p.likeCount });
    }
  },
});
