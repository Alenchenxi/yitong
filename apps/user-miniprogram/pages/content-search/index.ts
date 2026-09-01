import type { AppInstance } from '../../app';
import { searchPosts, type PostVo } from '../../services/confession';
import { listJobPosts, type JobPostVo } from '../../services/job';
import { addHistory, getHistory, clearHistory } from '../../utils/search-history';
import { formatTime } from '../../utils/auth';

// 内容搜索页（广场搜索栏落地页）：表白墙 / 兼职，按当前圈子作用域
type Tab = 'confession' | 'job';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'confession', label: '表白墙' },
  { key: 'job', label: '兼职' },
];

Page({
  data: {
    q: '',
    tabs: TABS,
    tab: 'confession' as Tab,
    loading: false,
    history: [] as string[],
    hasSearched: false,
    postResults: [] as Array<PostVo & { timeText: string }>,
    jobResults: [] as JobPostVo[],
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.setData({ history: getHistory() });
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ q: e.detail.value });
  },

  onConfirm() {
    this.runSearch();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as Tab;
    this.setData({ tab });
    if (this.data.hasSearched) this.runSearch();
  },

  tapHistory(e: WechatMiniprogram.TouchEvent) {
    const kw = (e.currentTarget.dataset.kw as string) ?? '';
    this.setData({ q: kw });
    this.runSearch();
  },

  clearHistoryTap() {
    clearHistory();
    this.setData({ history: [] });
  },

  async runSearch() {
    const q = this.data.q.trim();
    if (!q || this.data.loading) return;
    this.setData({ loading: true, hasSearched: true });
    addHistory(q);
    this.setData({ history: getHistory() });
    const app = getApp<AppInstance>();
    const communityId = app.globalData.activeCommunityId || undefined;
    try {
      if (this.data.tab === 'confession') {
        const r = await searchPosts(q, 20, communityId);
        this.setData({ postResults: r.list.map((p) => ({ ...p, timeText: formatTime(p.createdAt) })) });
      } else {
        const r = await listJobPosts({ keyword: q, communityId });
        this.setData({ jobResults: r.list });
      }
    } catch {
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openPost(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },

  openJob(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },
});
