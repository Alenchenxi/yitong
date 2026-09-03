// P1-16 树洞匹配历史
import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, listAnonMatches, type MatchHistoryItem } from '../../../services/treehole';
import { formatTime } from '../../../utils/auth';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

interface PageData {
  list: Array<MatchHistoryItem & { timeText: string }>;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

Page({
  data: {
    list: [],
    loading: true,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
  } as PageData,

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    bindAnonymousContentPageGuard(this);
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
    }
    await this.reload();
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  async reload() {
    this.setData({ list: [], page: 1, total: 0, hasMore: true, loading: true });
    try {
      const r = await listAnonMatches(1, this.data.pageSize);
      this.setData({
        list: r.list.map((x) => ({ ...x, timeText: formatTime(x.createdAt) })),
        total: r.total,
        hasMore: r.list.length < r.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      const r = await listAnonMatches(nextPage, this.data.pageSize);
      const fetched = r.list.map((x) => ({ ...x, timeText: formatTime(x.createdAt) }));
      const combined = [...this.data.list, ...fetched];
      this.setData({
        list: combined,
        page: nextPage,
        total: r.total,
        hasMore: combined.length < r.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  async onPullDownRefresh() {
    await this.reload();
    wx.stopPullDownRefresh();
  },

  // 点击 ACTIVE 匹配 -> 跳聊天页继续聊
  openChat(e: WechatMiniprogram.TouchEvent) {
    const matchId = String(e.currentTarget.dataset.matchId ?? '');
    const peerAnonId = String(e.currentTarget.dataset.peerAnonId ?? '');
    const status = String(e.currentTarget.dataset.status ?? '');
    if (!matchId || !peerAnonId || status !== 'ACTIVE') {
      wx.showToast({ title: '匹配已关闭', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/treehole/chat/index?matchId=${encodeURIComponent(matchId)}&peerAnonId=${encodeURIComponent(peerAnonId)}`,
    });
  },
});
