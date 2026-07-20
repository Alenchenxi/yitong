import type { AppInstance } from '../../app';
import { feed, toggleLike, type PostVo } from '../../services/confession';
import { listAnnouncements, type AnnouncementVo } from '../../services/announcement';

type MainTab = 'recommend' | 'latest' | 'hot' | 'follow';

interface PageData {
  posts: PostVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  activeMainTab: MainTab;
  announcements: AnnouncementVo[];
}

Page({
  data: {
    posts: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    activeMainTab: 'recommend',
    announcements: [],
  } as PageData,

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.data.posts.length === 0) this.reloadFeed();
    listAnnouncements().then((a) => this.setData({ announcements: a })).catch(() => {});
  },

  async reloadFeed() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const resp = await feed(this.data.nextCursor ?? undefined, 20, this.data.activeMainTab);
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
    } catch {
      // toast 已在 request 内
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

  switchMainTab(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset.tab as MainTab) ?? 'recommend';
    if (tab === this.data.activeMainTab) return;
    this.setData({ activeMainTab: tab });
    this.reloadFeed();
  },

  goSearch() {
    wx.showToast({ title: '搜索开发中', icon: 'none' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/post-create/index' });
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
});
