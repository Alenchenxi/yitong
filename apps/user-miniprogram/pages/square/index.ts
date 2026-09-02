import type { AppInstance } from '../../app';
import { squareFeed, squareTodayHit, type FeedItemVo, type TodayHitItem } from '../../services/square';
import { feed, toggleLike } from '../../services/confession';
import {
  listPosts as listTreeholePosts,
  toggleAnonPostLike,
  hasAnonToken,
  getAnonymousToken,
} from '../../services/treehole';
import { isJobListCursorExpired, listJobPosts } from '../../services/job';
import {
  acceptCommunityInvite,
  getActiveCommunity,
  getCommunity,
  leaveCommunity,
  listBanners,
  type CommunityVo,
  type BannerVo,
} from '../../services/community';
import { listAnnouncements, type AnnouncementVo } from '../../services/announcement';

// 广场（圈子首页）：树洞能力由全局匿名内容开关控制。
type PlazaTab = 'dynamic' | 'confession' | 'treehole' | 'job';

function inviteErrorCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = Number((error as { code?: unknown }).code);
  return Number.isFinite(code) ? code : null;
}

interface PageData {
  community: CommunityVo | null;
  banners: BannerVo[];
  todayHit: TodayHitItem[];
  items: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  cursorResetAttempted: boolean;
  activeTab: PlazaTab;
  announcements: AnnouncementVo[];
  anonymousContentEnabled: boolean;
  anonTokenReady: boolean;
  menuVisible: boolean;
  navTop: number;
  navHeight: number;
  navRight: number;
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
    cursorResetAttempted: false,
    activeTab: 'dynamic' as PlazaTab,
    announcements: [],
    anonymousContentEnabled: false,
    anonTokenReady: false,
    menuVisible: false,
    navTop: 0,
    navHeight: 44,
    navRight: 12,
  } as PageData,

  onLoad(options: Record<string, string | undefined>) {
    const app = getApp<AppInstance>();
    const inviteCommunityId = options.inviteCommunityId;
    if (inviteCommunityId) {
      this._inviteCommunityId = inviteCommunityId;
      app.globalData.pendingCommunityInviteId = inviteCommunityId;
    }

    const system = wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navTop = system.statusBarHeight ?? 0;
    const menuValid = menu.left > 0 && menu.top >= navTop && menu.width > 0 && menu.height > 0;
    const navHeight = menuValid ? Math.max(40, (menu.top - navTop) * 2 + menu.height) : 44;
    const navRight = menuValid ? Math.max(12, system.screenWidth - menu.left + 8) : 12;
    this.setData({ navTop, navHeight, navRight });
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    const activeTab = !anonymousContentEnabled && this.data.activeTab === 'treehole'
      ? 'dynamic'
      : this.data.activeTab;
    this.setData({ anonymousContentEnabled, activeTab });
    if (anonymousContentEnabled) {
      this.setData({ anonTokenReady: hasAnonToken() });
      if (!hasAnonToken()) {
        getAnonymousToken()
          .then(() => this.setData({ anonTokenReady: true }))
          .catch(() => {});
      }
    }
    await this.consumeCommunityInvite();

    const prevCommunityId = this.data.community?.id ?? '';
    await this.ensureCommunity();
    const newCommunityId = this.data.community?.id ?? '';
    if (newCommunityId) {
      // 已加入圈子：复位加入页门闩（便于退出圈子后再次引导）
      app.globalData.joinGate = false;
      if (newCommunityId !== prevCommunityId) {
        // 圈子变化（首载或切换）→ 刷新 头卡/轮播/今日上头/列表
        await this.refreshOps();
        await this.reloadFeed();
      } else if (this.data.items.length === 0) {
        this.reloadFeed();
      }
    } else if (!app.globalData.joinGate) {
      // 未加入任何圈子 → 引导加入页（门闩防返回无限跳）
      app.globalData.joinGate = true;
      wx.navigateTo({ url: '/pages/community/join/index' });
    }
    listAnnouncements().then((a) => this.setData({ announcements: a })).catch(() => {});
  },

  onHide() {
    // 离开页面时废弃未完成的详情请求，避免返回后展开旧圈子的菜单。
    this._communityMenuRequestSeq += 1;
    this.setData({ menuVisible: false });
  },

  // 分享进入后消费邀请：重叠 onShow 共用同一排空任务，期间到达的新邀请在页面刷新前顺序续接。
  consumeCommunityInvite() {
    const app = getApp<AppInstance>();
    const pendingCommunityId = app.globalData.pendingCommunityInviteId;
    if (pendingCommunityId && pendingCommunityId !== this._inviteCommunityId) {
      // 热启动收到新分享时以最新邀请为准。
      this._inviteCommunityId = pendingCommunityId;
    }
    if (this._inviteConsumePromise) return this._inviteConsumePromise;

    const task = this.drainCommunityInvites();
    let inFlight: Promise<void>;
    inFlight = task.finally(() => {
      if (this._inviteConsumePromise === inFlight) {
        this._inviteConsumePromise = null;
      }
    });
    this._inviteConsumePromise = inFlight;
    return inFlight;
  },

  async drainCommunityInvites() {
    let lastAttemptedCommunityId = '';
    while (true) {
      const app = getApp<AppInstance>();
      const pendingCommunityId = app.globalData.pendingCommunityInviteId;
      if (pendingCommunityId && pendingCommunityId !== this._inviteCommunityId) {
        this._inviteCommunityId = pendingCommunityId;
      }
      const communityId = this._inviteCommunityId || pendingCommunityId;
      // 同一个可恢复失败留待下次 onShow 重试，避免当前排空任务内无限循环。
      if (!communityId || communityId === lastAttemptedCommunityId) return;
      lastAttemptedCommunityId = communityId;
      await this.doConsumeCommunityInvite(communityId);
    }
  },

  async doConsumeCommunityInvite(communityId: string) {
    const app = getApp<AppInstance>();
    try {
      const result = await acceptCommunityInvite(communityId);
      this.clearCommunityInvite(communityId);
      app.globalData.activeCommunityId = result.id;
      app.globalData.joinGate = false;
      wx.showToast({
        title: result.joined ? '已加入并切换圈子' : '已切换到邀请圈子',
        icon: 'none',
      });
    } catch (error) {
      const code = inviteErrorCode(error);
      if (code === 80010 || code === 80011) {
        this.clearCommunityInvite(communityId);
      }
      // 圈子不存在/已禁用不再重试；鉴权失效或网络错误保留邀请，重新登录/onShow 后继续消费。
    }
  },

  clearCommunityInvite(communityId: string) {
    const app = getApp<AppInstance>();
    if (this._inviteCommunityId === communityId) this._inviteCommunityId = '';
    if (app.globalData.pendingCommunityInviteId === communityId) {
      app.globalData.pendingCommunityInviteId = '';
    }
  },

  // 当前圈子：服务端 getActiveCommunity（未加入 → null，广场显示空态并引导加入页），落 globalData 供发帖作用域
  async ensureCommunity() {
    const app = getApp<AppInstance>();
    try {
      const c = await getActiveCommunity();
      if (c) {
        app.globalData.activeCommunityId = c.id;
        this.setData({ community: c });
      } else {
        app.globalData.activeCommunityId = '';
        this.setData({ community: null });
      }
    } catch {
      const cid = app.globalData.activeCommunityId;
      if (cid) this.setData({ community: { id: cid } as CommunityVo });
      else this.setData({ community: null });
    }
  },

  // 广告轮播 + 今日上头：随圈子刷新
  async refreshOps() {
    const communityId = this.data.community?.id;
    if (!communityId) return;
    const [hit, banners] = await Promise.all([
      squareTodayHit(communityId, 10)
        .then((result) => ({
          list: this.data.anonymousContentEnabled
            ? result.list
            : result.list.filter((item) =>
              item.kind !== 'anon_post' && !(item.kind === 'post' && item.data.isAnonymous)),
        }))
        .catch(() => ({ list: [] as TodayHitItem[] })),
      listBanners(communityId).catch(() => [] as BannerVo[]),
    ]);
    this.setData({ todayHit: hit.list, banners });
  },

  async reloadFeed() {
    this.setData({
      items: [],
      nextCursor: null,
      hasMore: true,
      cursorResetAttempted: false,
    });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    const communityId = this.data.community?.id;
    this.setData({ loading: true });
    let resetExpiredJobCursor = false;
    try {
      const tab = this.data.activeTab;
      let resp: { list: FeedItemVo[]; nextCursor: string | null; hasMore: boolean };
      if (tab === 'dynamic') {
        resp = await squareFeed(this.data.nextCursor ?? undefined, 20, 'recommend', communityId);
        if (!this.data.anonymousContentEnabled) {
          resp = {
            ...resp,
            list: resp.list.filter((item) =>
              item.kind !== 'anon_post' && !(item.kind === 'post' && item.data.isAnonymous)),
          };
        }
      } else if (tab === 'confession') {
        const r = await feed(this.data.nextCursor ?? undefined, 20, 'latest', communityId);
        resp = {
          list: r.list
            .filter((post) => this.data.anonymousContentEnabled || !post.isAnonymous)
            .map((p) => ({ kind: 'post' as const, data: p })),
          nextCursor: r.nextCursor,
          hasMore: r.hasMore,
        };
      } else if (tab === 'treehole' && this.data.anonymousContentEnabled) {
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
    } catch (error) {
      if (
        this.data.activeTab === 'job'
        && this.data.nextCursor
        && !this.data.cursorResetAttempted
        && isJobListCursorExpired(error)
      ) {
        resetExpiredJobCursor = true;
        this.setData({
          items: [],
          nextCursor: null,
          hasMore: true,
          cursorResetAttempted: true,
        });
      }
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
    if (resetExpiredJobCursor) await this.loadMore();
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
    this.setData({ menuVisible: false });
    wx.navigateTo({ url: '/pages/community/list/index' });
  },

  // 顶部操作栏左侧 → 圈子切换页
  goSwitch() {
    wx.navigateTo({ url: '/pages/community/list/index' });
  },

  // 广场搜索栏 → 内容搜索页（树洞分类由全局开关控制）
  goSearch() {
    wx.navigateTo({ url: '/pages/content-search/index' });
  },

  async showCommunityMenu() {
    const current = this.data.community;
    if (!current) return;
    const requestSeq = ++this._communityMenuRequestSeq;
    try {
      const community = await getCommunity(current.id);
      if (
        requestSeq !== this._communityMenuRequestSeq ||
        this.data.community?.id !== current.id
      ) return;
      this.setData({ community });
    } catch {
      // 详情刷新失败时仍允许打开菜单，展示页面当前已有信息。
    }
    if (
      requestSeq !== this._communityMenuRequestSeq ||
      this.data.community?.id !== current.id
    ) return;
    this.setData({ menuVisible: true });
  },

  hideCommunityMenu() {
    this.setData({ menuVisible: false });
  },

  stopMenuTap() {},

  confirmLeaveCommunity() {
    const community = this.data.community;
    if (!community) return;
    if (community.myRole === 'OWNER') {
      wx.showToast({ title: '圈主不能退出圈子', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '退出圈子',
      content: `确定退出「${community.name}」吗？`,
      success: (result) => {
        if (!result.confirm) return;
        leaveCommunity(community.id)
          .then(() => {
            const app = getApp<AppInstance>();
            app.globalData.activeCommunityId = '';
            app.globalData.joinGate = true;
            this.setData({
              community: null,
              menuVisible: false,
              items: [],
              nextCursor: null,
              hasMore: true,
            });
            wx.showToast({ title: '已退出', icon: 'success' });
            wx.navigateTo({ url: '/pages/community/join/index' });
          })
          .catch(() => {});
      },
    });
  },

  onShareAppMessage() {
    const community = this.data.community;
    if (!community) {
      return { title: '来燚桐发现校园生活', path: '/pages/square/index' };
    }
    return {
      title: `邀请你加入「${community.name}」圈子`,
      path: `/pages/square/index?inviteCommunityId=${encodeURIComponent(community.id)}`,
      imageUrl: community.backgroundImage || community.logo || undefined,
    };
  },

  // FAB：匿名内容开启时允许选择树洞发布，否则直接进入表白墙发布。
  goCreate() {
    if (!this.data.anonymousContentEnabled) {
      wx.navigateTo({ url: '/pages/post-create/index' });
      return;
    }
    wx.showActionSheet({
      itemList: ['表白墙', '树洞'],
      success: (result) => {
        wx.navigateTo({
          url: result.tapIndex === 1 ? '/pages/treehole/post/index' : '/pages/post-create/index',
        });
      },
    });
  },

  goPostDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/treehole/detail/index?id=${id}` });
  },

  goAnonAuthor(e: WechatMiniprogram.CustomEvent) {
    const anonId = (e.detail as { anonId?: string }).anonId;
    if (anonId) {
      wx.navigateTo({ url: `/pages/treehole/author/index?anonId=${encodeURIComponent(anonId)}` });
    }
  },

  // 今日上头条目按内容来源跳转。
  goTodayHit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const kind = e.currentTarget.dataset.kind as string;
    if (!id) return;
    wx.navigateTo({
      url: kind === 'anon_post'
        ? `/pages/treehole/detail/index?id=${id}`
        : `/pages/post-detail/index?id=${id}`,
    });
  },

  // 点赞分发：表白墙与树洞分别使用真实身份/匿名身份接口。
  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    const idx = this.data.items.findIndex((item) => item.data.id === id);
    if (idx < 0) return;
    const item = this.data.items[idx];
    if (item.kind === 'job_post') return;
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

  _inviteCommunityId: '',
  _inviteConsumePromise: null as Promise<void> | null,
  _communityMenuRequestSeq: 0,
});
