import type { AppInstance } from '../../app';
import { squareFeed, type FeedItemVo } from '../../services/square';
import { toggleLike } from '../../services/confession';
import { hasAnonToken } from '../../services/treehole';
import { listAnnouncements, type AnnouncementVo } from '../../services/announcement';

type MainTab = 'recommend' | 'latest';

interface PageData {
  items: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  activeMainTab: MainTab;
  announcements: AnnouncementVo[];
  anonTokenReady: boolean; // CR-001 当前 anonToken 状态（匿名帖 disabled 判断）
}

// CR-001 广场混合流：推荐 / 最新 2 tab，表白墙帖 + 匿名帖穿插混排
Page({
  data: {
    items: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    activeMainTab: 'recommend' as MainTab,
    announcements: [],
    anonTokenReady: false,
  } as PageData,

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 每个 onShow 周期刷新 anonToken 状态（用户可能刚从树洞回来已签发）
    this.setData({ anonTokenReady: hasAnonToken() });
    if (this.data.items.length === 0) this.reloadFeed();
    listAnnouncements().then((a) => this.setData({ announcements: a })).catch(() => {});
  },

  async reloadFeed() {
    this.setData({ items: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const resp = await squareFeed(this.data.nextCursor ?? undefined, 20, this.data.activeMainTab);
      this.setData({
        items: [...this.data.items, ...resp.list],
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

  // CR-001: 按 kind 分发跳转——表白墙帖跳 post-detail，匿名帖跳 treehole post-detail
  goPostDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const kind = e.currentTarget.dataset.kind as string;
    if (!id) return;
    if (kind === 'anon_post') {
      wx.navigateTo({ url: `/pages/treehole/post-detail/index?id=${id}` });
    } else {
      wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
    }
  },

  // CR-001: 按 kind 分发点赞——表白墙帖走 uid 点赞，匿名帖走 anonToken 点赞
  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    const idx = this.data.items.findIndex((item) => item.data.id === id);
    if (idx < 0) return;
    const kind = this.data.items[idx].kind;

    // 匿名帖需 anonToken；缺失时 disabled 已由 post-card 处理（toast 提示），不再重复点赞
    if (kind === 'anon_post' && !hasAnonToken()) return;

    const item = this.data.items[idx];
    const p = item.data;
    const nextLiked = !p.liked;
    const nextCount = p.likeCount + (nextLiked ? 1 : -1);
    this.setData({
      [`items[${idx}].data.liked`]: nextLiked,
      [`items[${idx}].data.likeCount`]: Math.max(0, nextCount),
    });
    try {
      // TODO: 树洞点赞接口独立调用（anonToken 路径），当前暂走表白墙路径占位
      // 后续补：if (kind === 'anon_post') { toggleAnonPostLike(id); } else { toggleLike(id); }
      await toggleLike(id);
    } catch {
      // 回滚
      this.setData({
        [`items[${idx}].data.liked`]: p.liked,
        [`items[${idx}].data.likeCount`]: p.likeCount,
      });
    }
  },
});