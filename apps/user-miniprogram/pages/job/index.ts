import type { AppInstance } from '../../app';
import { listJobPosts, recommendJobs, type JobPostVo } from '../../services/job';

type Tab = 'recommend' | 'latest' | 'urgent';

Page({
  data: {
    tab: 'recommend' as Tab,
    posts: [] as JobPostVo[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    isMerchant: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const isMerchant = app.globalData.currentRole === 'MERCHANT';
    // 商家视角不显示 tab（仅看自己发的岗位）
    this.setData({ isMerchant, tab: isMerchant ? 'latest' : 'recommend' });
    this.reload();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const t = (e.currentTarget.dataset.tab as Tab) ?? 'recommend';
    if (t === this.data.tab) return;
    this.setData({ tab: t });
    this.reload();
  },

  async reload() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    if (this.data.tab === 'recommend') {
      await this.loadRecommend();
    } else {
      // latest 全量；urgent 只看急招（P0-17 urgent 字段过滤）
      await this.loadMore();
    }
  },

  async loadRecommend() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const list = await recommendJobs();
      this.setData({ posts: list, hasMore: false, nextCursor: null });
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
      const urgent = this.data.tab === 'urgent';
      const resp = await listJobPosts(this.data.nextCursor ?? undefined, false, urgent);
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
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
    if (this.data.tab !== 'recommend') this.loadMore();
  },

  goSearch() {
    wx.showToast({ title: '搜索开发中', icon: 'none' });
  },
  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },
  goPost() {
    wx.navigateTo({ url: '/pages/job/post/index' });
  },
  goManage() {
    wx.navigateTo({ url: '/pages/job/manage/index' });
  },
  goMyApps() {
    wx.navigateTo({ url: '/pages/job/my-applications/index' });
  },
});
