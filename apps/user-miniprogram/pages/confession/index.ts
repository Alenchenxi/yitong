import type { AppInstance } from '../../app';
import { feed, toggleLike, type PostVo } from '../../services/confession';
import { listAnnouncements, type AnnouncementVo } from '../../services/announcement';
import { syncCustomTabBar } from '../../utils/custom-tabbar';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';

type MainTab = 'recommend' | 'latest' | 'hot' | 'follow' | 'nearby';

interface NearbyPeopleComponent {
  refresh(): void;
  loadMore(): void;
}

interface PageData {
  posts: PostVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  activeMainTab: MainTab;
  announcements: AnnouncementVo[];
  anonymousContentEnabled: boolean;
}

Page({
  data: {
    posts: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    activeMainTab: 'recommend',
    announcements: [],
    anonymousContentEnabled: false,
  } as PageData,

  onLoad() {
    bindAnonymousContentVisibility(this, (enabled) => {
      const changed = enabled !== this.data.anonymousContentEnabled;
      this.updateAnonymousContentVisibility(enabled);
      if (changed && this.data.posts.length > 0) void this.reloadFeed();
    });
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    this.setData({
      anonymousContentEnabled: enabled,
      posts: enabled ? this.data.posts : this.data.posts.filter((post) => !post.isAnonymous),
    });
  },

  async onShow() {
    syncCustomTabBar(this, '/pages/confession/index');
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    const visibilityChanged = anonymousContentEnabled !== this.data.anonymousContentEnabled;
    this.updateAnonymousContentVisibility(anonymousContentEnabled);
    if (this.data.activeMainTab === 'nearby') {
      wx.nextTick(() => this.getNearbyComponent()?.refresh());
    } else if (visibilityChanged || this.data.posts.length === 0) {
      this.reloadFeed();
    }
    listAnnouncements()
      .then((a) => this.setData({ announcements: a }))
      .catch(() => {});
  },

  async reloadFeed() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore || this.data.activeMainTab === 'nearby') return;
    this.setData({ loading: true });
    try {
      const resp = await feed(this.data.nextCursor ?? undefined, 20, this.data.activeMainTab);
      const visiblePosts = this.data.anonymousContentEnabled
        ? resp.list
        : resp.list.filter((post) => !post.isAnonymous);
      this.setData({
        posts: [...this.data.posts, ...visiblePosts],
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
    if (this.data.activeMainTab === 'nearby') {
      this.getNearbyComponent()?.refresh();
      return;
    }
    this.reloadFeed();
  },

  onReachBottom() {
    if (this.data.activeMainTab === 'nearby') {
      this.getNearbyComponent()?.loadMore();
      return;
    }
    this.loadMore();
  },

  switchMainTab(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset.tab as MainTab) ?? 'recommend';
    if (tab === this.data.activeMainTab) return;
    this.setData({ activeMainTab: tab });
    if (tab !== 'nearby') this.reloadFeed();
  },

  getNearbyComponent() {
    return this.selectComponent('#confession-nearby') as unknown as NearbyPeopleComponent | null;
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
      title: '表白墙',
      path: id ? `/pages/post-detail/index?id=${id}` : '/pages/confession/index',
    };
  },
});
