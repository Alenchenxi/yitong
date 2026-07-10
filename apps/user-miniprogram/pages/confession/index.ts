import type { AppInstance } from '../../app';
import { listCircles, feed, toggleLike, type Circle, type PostVo } from '../../services/confession';

interface PageData {
  circles: Circle[];
  posts: PostVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  activeTab: 'feed' | string; // 'feed' = 发现，其它为 circleId
  activeCircleName: string;
}

Page({
  data: {
    circles: [],
    posts: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    activeTab: 'feed',
    activeCircleName: '发现',
  } as PageData,

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 首次加载：拉圈子 + 发现流
    if (this.data.circles.length === 0) {
      this.loadCircles();
      this.reloadFeed();
    } else {
      // 从详情/发帖返回时刷新当前列表（点赞状态可能变）
      this.reloadFeed();
    }
  },

  async loadCircles() {
    try {
      const circles = await listCircles();
      this.setData({ circles });
    } catch {
      // 已在 request 里 toast 了
    }
  },

  async reloadFeed() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const resp = await feed(this.data.nextCursor ?? undefined, 20);
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
    } catch {
      // 已 toast
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.reloadFeed();
  },

  onReachBottom() {
    this.loadMore();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const { id, name } = e.currentTarget.dataset as { id: string; name: string };
    this.setData({ activeTab: id, activeCircleName: name, posts: [], nextCursor: null, hasMore: true });
    if (id === 'feed') {
      this.reloadFeed();
    } else {
      // 切到圈子：先调 listCirclePosts 覆盖 feed 逻辑
      this.loadCirclePosts(id);
    }
  },

  async loadCirclePosts(circleId: string, cursor?: string) {
    if (this.data.loading || (cursor && !this.data.hasMore)) return;
    this.setData({ loading: true });
    try {
      const { listCirclePosts } = await import('../../services/confession');
      const resp = await listCirclePosts(circleId, cursor, 20);
      this.setData({
        posts: cursor ? [...this.data.posts, ...resp.list] : resp.list,
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
    } catch {
      // toast
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  goCreate() {
    const app = getApp<AppInstance>();
    // 选中圈子时带 circleId，否则让发帖页选
    const cid = this.data.activeTab !== 'feed' ? this.data.activeTab : '';
    wx.navigateTo({
      url: cid ? `/pages/post-create/index?circleId=${cid}` : '/pages/post-create/index',
    });
  },

  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    // 乐观更新 UI
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
      // 回滚
      this.setData({
        [`posts[${idx}].liked`]: p.liked,
        [`posts[${idx}].likeCount`]: p.likeCount,
      });
    }
  },
});
