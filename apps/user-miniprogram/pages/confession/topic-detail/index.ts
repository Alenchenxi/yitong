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
    anonymousContentEnabled: false,
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
    this.setData({
      anonymousContentEnabled: await app.getAnonymousContentVisibility(),
    });
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
      const visiblePosts = this.data.anonymousContentEnabled
        ? r.posts.list
        : r.posts.list.filter((post) => !post.isAnonymous);
      const currentPage = this.data.page;
      this.setData({
        topic: r.topic,
        posts: [...this.data.posts, ...visiblePosts],
        total: r.posts.total,
        page: currentPage + 1,
        hasMore: r.posts.list.length > 0 && currentPage * this.data.pageSize < r.posts.total,
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

  // 转发给微信好友：post-card 转发按钮触发（data-id 定位），无 id 时 fallback 本页
  onShareAppMessage(e: { target?: { dataset?: { id?: string } } }) {
    const id = e?.target?.dataset?.id ?? '';
    return {
      title: this.data.topic ? `#${this.data.topic.name}#` : '校园话题',
      path: id ? `/pages/post-detail/index?id=${id}` : `/pages/confession/topic-detail/index?id=${this.topicId}`,
    };
  },
});
