import type { AppInstance } from '../../app';
import { squareFeed, squareTodayHit, type FeedItemVo, type TodayHitItem } from '../../services/square';
import { feed, toggleLike } from '../../services/confession';
import {
  listPosts as listTreeholePosts,
  toggleAnonPostLike,
  hasAnonToken,
  getAnonymousToken,
} from '../../services/treehole';
import { listJobPosts } from '../../services/job';
import {
  getActiveCommunity,
  listBanners,
  type CommunityVo,
  type BannerVo,
} from '../../services/community';
import { listAnnouncements, type AnnouncementVo } from '../../services/announcement';

// 广场（圈子首页）：圈子头卡 + 广告轮播 + 今日上头 + 4 tab（圈子动态/表白墙/树洞/兼职）
type PlazaTab = 'dynamic' | 'confession' | 'treehole' | 'job';

interface PageData {
  community: CommunityVo | null;
  banners: BannerVo[];
  todayHit: TodayHitItem[];
  items: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  activeTab: PlazaTab;
  announcements: AnnouncementVo[];
  anonTokenReady: boolean; // 匿名帖 disabled 判断
}

Page({
  data: {
    community: null,
    banners: [],
    todayHit: [],
    items: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    activeTab: 'dynamic' as PlazaTab,
    announcements: [],
    anonTokenReady: false,
  } as PageData,

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 每个 onShow 周期刷新 anonToken 状态（用户可能刚从树洞回来已签发）；缺失时静默补签
    this.setData({ anonTokenReady: hasAnonToken() });
    if (!hasAnonToken()) getAnonymousToken().catch(() => {});

    const prevCommunityId = this.data.community?.id ?? '';
    await this.ensureCommunity();
    const newCommunityId = this.data.community?.id ?? '';
    if (newCommunityId && newCommunityId !== prevCommunityId) {
      // 圈子变化（首载或切换）→ 刷新 头卡/轮播/今日上头/列表
      await this.refreshOps();
      await this.reloadFeed();
    } else if (this.data.items.length === 0) {
      this.reloadFeed();
    }
    listAnnouncements().then((a) => this.setData({ announcements: a })).catch(() => {});
  },

  // 当前圈子：优先服务端 getActiveCommunity（惰性确保默认），落 globalData 供发帖作用域
  async ensureCommunity() {
    const app = getApp<AppInstance>();
    try {
      const c = await getActiveCommunity();
      app.globalData.activeCommunityId = c.id;
      this.setData({ community: c });
    } catch {
      const cid = app.globalData.activeCommunityId;
      if (cid) this.setData({ community: { id: cid } as CommunityVo });
    }
  },

  // 广告轮播 + 今日上头：随圈子刷新
  async refreshOps() {
    const communityId = this.data.community?.id;
    if (!communityId) return;
    const [hit, banners] = await Promise.all([
      squareTodayHit(communityId, 10).catch(() => ({ list: [] as TodayHitItem[] })),
      listBanners(communityId).catch(() => [] as BannerVo[]),
    ]);
    this.setData({ todayHit: hit.list, banners });
  },

  async reloadFeed() {
    this.setData({ items: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    const communityId = this.data.community?.id;
    this.setData({ loading: true });
    try {
      const tab = this.data.activeTab;
      let resp: { list: FeedItemVo[]; nextCursor: string | null; hasMore: boolean };
      if (tab === 'dynamic') {
        resp = await squareFeed(this.data.nextCursor ?? undefined, 20, 'recommend', communityId);
      } else if (tab === 'confession') {
        const r = await feed(this.data.nextCursor ?? undefined, 20, 'latest', communityId);
        resp = {
          list: r.list.map((p) => ({ kind: 'post' as const, data: p })),
          nextCursor: r.nextCursor,
          hasMore: r.hasMore,
        };
      } else if (tab === 'treehole') {
        const r = await listTreeholePosts(this.data.nextCursor ?? undefined, 'latest', undefined, communityId);
        resp = {
          list: r.list.map((p) => ({ kind: 'anon_post' as const, data: p })),
          nextCursor: r.nextCursor,
          hasMore: r.hasMore,
        };
      } else {
        const r = await listJobPosts({ cursor: this.data.nextCursor ?? undefined, communityId });
        resp = {
          list: r.list.map((p) => ({ kind: 'job_post' as const, data: p })),
          nextCursor: r.nextCursor,
          hasMore: r.hasMore,
        };
      }
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
    this.ensureCommunity().then(() => {
      this.refreshOps();
      this.reloadFeed();
    });
  },

  onReachBottom() {
    this.loadMore();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset.tab as PlazaTab) ?? 'dynamic';
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    this.reloadFeed();
  },

  goCommunityList() {
    wx.navigateTo({ url: '/pages/community/list/index' });
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/confession-search/index' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/post-create/index' });
  },

  // 按 kind 分发跳详情（anon_post 用于树洞，job_post 岗位；post 兜底表白墙）
  goPostDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const kind = e.currentTarget.dataset.kind as string;
    if (!id) return;
    if (kind === 'anon_post') {
      wx.navigateTo({ url: `/pages/treehole/detail/index?id=${id}` });
    } else if (kind === 'job_post') {
      wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
    } else {
      wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
    }
  },

  // 今日上头条目点击：表白墙帖 → 表白墙详情；树洞帖 → 树洞详情
  goTodayHit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const kind = e.currentTarget.dataset.kind as string;
    if (!id) return;
    if (kind === 'anon_post') {
      wx.navigateTo({ url: `/pages/treehole/detail/index?id=${id}` });
    } else {
      wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
    }
  },

  // 点赞分发：post → 表白墙 toggleLike；anon_post → 树洞 toggleAnonPostLike（anonToken 路径）；job_post 无点赞
  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    const idx = this.data.items.findIndex((item) => item.data.id === id);
    if (idx < 0) return;
    const item = this.data.items[idx];
    if (item.kind === 'job_post') return;
    // 匿名帖需 anonToken；缺失时 disabled 已由 post-card 处理（toast 提示），不再重复点赞
    if (item.kind === 'anon_post' && !hasAnonToken()) return;

    const p = item.data;
    const nextLiked = !p.liked;
    const nextCount = p.likeCount + (nextLiked ? 1 : -1);
    this.setData({
      [`items[${idx}].data.liked`]: nextLiked,
      [`items[${idx}].data.likeCount`]: Math.max(0, nextCount),
    });
    try {
      if (item.kind === 'anon_post') await toggleAnonPostLike(id);
      else await toggleLike(id);
    } catch {
      // 回滚
      this.setData({
        [`items[${idx}].data.liked`]: p.liked,
        [`items[${idx}].data.likeCount`]: p.likeCount,
      });
    }
  },
});
