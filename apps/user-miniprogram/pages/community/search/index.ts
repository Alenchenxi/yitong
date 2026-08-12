import type { AppInstance } from '../../../app';
import {
  searchCommunities,
  switchCommunity,
  joinCommunity,
  type CommunityVo,
} from '../../../services/community';
import { addHistory, getHistory, clearHistory } from '../../../utils/search-history';

// 圈子搜索：历史搜索 + 结果列表；点结果 → 成员切换 / 非成员加入 → 回广场
Page({
  data: {
    q: '',
    loading: false,
    history: [] as string[],
    results: [] as CommunityVo[],
    hasSearched: false,
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
    try {
      const results = await searchCommunities(q);
      this.setData({ results });
    } catch {
      wx.showToast({ title: '搜索失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 点结果：成员 → 切换；非成员 → 加入；都回广场
  onTapResult(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const name = e.currentTarget.dataset.name as string;
    const isMember = e.currentTarget.dataset.member === true || e.currentTarget.dataset.member === 'true';
    if (!id) return;
    const action = isMember ? switchCommunity(id) : joinCommunity(id);
    action
      .then(() => {
        const app = getApp<AppInstance>();
        app.globalData.activeCommunityId = id;
        app.globalData.joinGate = false;
        wx.showToast({ title: isMember ? `已切换到「${name}」` : `已加入「${name}」`, icon: 'none' });
        wx.switchTab({ url: '/pages/square/index' });
      })
      .catch(() => {});
  },
});
