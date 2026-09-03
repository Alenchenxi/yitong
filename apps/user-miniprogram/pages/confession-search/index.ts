// P1-05/06/07 表白墙搜索页（帖子/用户/话题/历史/热门）
import type { AppInstance } from '../../app';
import {
  searchPosts,
  searchUsers,
  searchTags,
  hotKeywords,
  type PostVo,
  type UserSearchItem,
  type TagSearchItem,
  type HotKeyword,
} from '../../services/confession';
import { addHistory, getHistory, clearHistory } from '../../utils/search-history';
import { formatTime } from '../../utils/auth';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';

type Tab = 'post' | 'user' | 'tag';

interface PageData {
  q: string;
  tab: Tab;
  loading: boolean;
  history: string[];
  hot: HotKeyword[];
  postResults: Array<PostVo & { timeText: string }>;
  userResults: UserSearchItem[];
  tagResults: TagSearchItem[];
  hasSearched: boolean;
  anonymousContentEnabled: boolean;
}

function toPostViews(posts: PostVo[]) {
  return posts.map((p) => ({ ...p, timeText: formatTime(p.createdAt) }));
}

Page({
  data: {
    q: '',
    tab: 'post',
    loading: false,
    history: [],
    hot: [],
    postResults: [],
    userResults: [],
    tagResults: [],
    hasSearched: false,
    anonymousContentEnabled: false,
  } as PageData,

  onLoad() {
    bindAnonymousContentVisibility(this, (enabled) => {
      const changed = enabled !== this.data.anonymousContentEnabled;
      this.updateAnonymousContentVisibility(enabled);
      if (changed && this.data.hasSearched) void this.runSearch();
    });
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    this.setData({
      anonymousContentEnabled: enabled,
      postResults: enabled
        ? this.data.postResults
        : this.data.postResults.filter((post) => !post.isAnonymous),
    });
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const anonymousContentEnabled = await app.getAnonymousContentVisibility();
    this.updateAnonymousContentVisibility(anonymousContentEnabled);
    this.setData({ history: getHistory() });
    this.loadHot();
  },

  async loadHot() {
    try {
      const r = await hotKeywords();
      this.setData({ hot: r.list });
    } catch {
      /* ignore */
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ q: e.detail.value });
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = e.currentTarget.dataset.tab as Tab;
    this.setData({ tab });
    if (this.data.hasSearched) this.runSearch();
  },

  async onConfirm() {
    await this.runSearch();
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
    if (!q) return;
    if (this.data.loading) return;
    this.setData({ loading: true });
    addHistory(q);
    this.setData({ history: getHistory() });
    try {
      if (this.data.tab === 'post') {
        const r = await searchPosts(q, 20);
        const visiblePosts = this.data.anonymousContentEnabled
          ? r.list
          : r.list.filter((post) => !post.isAnonymous);
        this.setData({ postResults: toPostViews(visiblePosts), hasSearched: true });
      } else if (this.data.tab === 'user') {
        const r = await searchUsers(q, 20);
        this.setData({ userResults: r.list, hasSearched: true });
      } else {
        const r = await searchTags(q, 20);
        this.setData({ tagResults: r.list, hasSearched: true });
      }
    } catch {
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openPost(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },
});
