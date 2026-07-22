import type { AppInstance } from '../../app';
import { feed, toggleLike, listHotTop, listTodayHit, type PostVo } from '../../services/confession';
import { listAnnouncements, type AnnouncementVo } from '../../services/announcement';

type MainTab = 'recommend' | 'latest' | 'hot' | 'follow';

interface PageData {
  posts: PostVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  activeMainTab: MainTab;
  announcements: AnnouncementVo[];
  hotTop: PostVo[]; // P2-01 置顶最热
  todayHit: PostVo[]; // P2-02 今日上头
}

Page({
  data: {
    posts: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    activeMainTab: 'recommend',
    announcements: [],
    hotTop: [],
    todayHit: [],
  } as PageData,

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.data.posts.length === 0) this.reloadFeed();
    listAnnouncements().then((a) => this.setData({ announcements: a })).catch(() => {});
    // P2-01/P2-02 运营位
    listHotTop(10).then((r) => this.setData({ hotTop: r.list })).catch(() => {});
    listTodayHit(1, 10).then((r) => this.setData({ todayHit: r.list })).catch(() => {});
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
    wx.navigateTo({ url: '/pages/confession-search/index' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/post-create/index' });
  },

  goPostDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },

  goTodayHit() {
    wx.navigateTo({ url: '/pages/confession/today-hit/index' });
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
