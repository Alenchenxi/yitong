import type { AppInstance } from '../../app';
import { listJobPosts, recommendJobs, recordJobImpressions, type JobPostVo } from '../../services/job';

type Tab = 'recommend' | 'latest' | 'urgent' | 'nearest';

Page({
  data: {
    tab: 'recommend' as Tab,
    posts: [] as JobPostVo[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    isMerchant: false,
    userLng: 0,
    userLat: 0,
    hasLocation: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const isMerchant = app.globalData.currentRole === 'MERCHANT';
    this.setData({ isMerchant, tab: isMerchant ? 'latest' : 'recommend' });
    this.reload();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const t = (e.currentTarget.dataset.tab as Tab) ?? 'recommend';
    if (t === this.data.tab) return;
    this.setData({ tab: t });
    if (t === 'nearest' && !this.data.hasLocation) {
      this.getLocationAndLoad();
    } else {
      this.reload();
    }
  },

  getLocationAndLoad() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ userLng: res.longitude, userLat: res.latitude, hasLocation: true });
        this.reload();
      },
      fail: () => {
        wx.showToast({ title: '需要位置权限查看附近岗位', icon: 'none' });
        this.setData({ tab: 'recommend', hasLocation: false });
      },
    });
  },

  async reload() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    if (this.data.tab === 'recommend') {
      await this.loadRecommend();
    } else {
      await this.loadMore();
    }
  },

  async loadRecommend() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const list = await recommendJobs();
      this.setData({ posts: list, hasMore: false, nextCursor: null });
      this.reportImpressions(list);
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const isUrgent = this.data.tab === 'urgent';
      const isNearest = this.data.tab === 'nearest';
      const resp = await listJobPosts({
        cursor: this.data.nextCursor ?? undefined,
        urgent: isUrgent || undefined,
        sort: isNearest ? 'nearest' : undefined,
        userLng: isNearest ? this.data.userLng : undefined,
        userLat: isNearest ? this.data.userLat : undefined,
      });
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
      this.reportImpressions(resp.list);
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
    if (this.data.tab !== 'recommend') this.loadMore();
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/job/search/index' });
  },
  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },
  goPost() {
    // 2026-08-11:统一走新发布入口页(类别网格 + 搜索选点 同页)
    wx.navigateTo({ url: '/pages/job/publish/index' });
  },

  // M3-08 曝光上报：数据加载完成后批量上报可见岗位 ID
  reportImpressions(posts: JobPostVo[]) {
    const ids = posts.map((p) => p.id).filter(Boolean);
    if (!ids.length) return;
    // 容错：失败静默
    recordJobImpressions(ids).catch(() => {});
  },
  goManage() {
    wx.navigateTo({ url: '/pages/merchant/index?tab=jobs' });
  },
  goMyApps() {
    wx.navigateTo({ url: '/pages/job/my-applications/index' });
  },
});
