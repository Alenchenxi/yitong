// P1-09 我的关注 / 我的粉丝 tab 列表
import type { AppInstance } from '../../app';
import { myFollowing, myFollowers, toggleFollow, type FollowUserItem } from '../../services/follow';
import { formatTime } from '../../utils/auth';

type Mode = 'following' | 'followers';

interface PageData {
  mode: Mode;
  list: Array<FollowUserItem & { timeText: string }>;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

Page({
  data: {
    mode: 'following',
    list: [],
    loading: true,
    page: 1,
    pageSize: 30,
    total: 0,
    hasMore: true,
  } as PageData,

  onLoad(options: { mode?: string }) {
    if (options?.mode === 'followers') this.setData({ mode: 'followers' });
    wx.setNavigationBarTitle({ title: this.data.mode === 'followers' ? '我的粉丝' : '我的关注' });
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.reload();
  },

  async reload() {
    this.setData({ list: [], page: 1, total: 0, hasMore: true, loading: true });
    try {
      const fn = this.data.mode === 'followers' ? myFollowers : myFollowing;
      const r = await fn(1, this.data.pageSize);
      const list = r.list.map((x) => ({ ...x, timeText: formatTime(x.followedAt) }));
      this.setData({
        list,
        total: r.total,
        hasMore: list.length < r.total,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  switchMode(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as Mode;
    if (mode === this.data.mode) return;
    this.setData({ mode });
    wx.setNavigationBarTitle({ title: mode === 'followers' ? '我的粉丝' : '我的关注' });
    this.reload();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const nextPage = this.data.page + 1;
      const fn = this.data.mode === 'followers' ? myFollowers : myFollowing;
      const r = await fn(nextPage, this.data.pageSize);
      const fetched = r.list.map((x) => ({ ...x, timeText: formatTime(x.followedAt) }));
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

  // 取关（仅 following 模式可操作）
  async unfollow(e: WechatMiniprogram.TouchEvent) {
    if (this.data.mode !== 'following') return;
    const userId = e.currentTarget.dataset.id as string;
    if (!userId) return;
    try {
      await toggleFollow(userId);
      this.setData({
        list: this.data.list.filter((x) => x.userId !== userId),
        total: Math.max(0, this.data.total - 1),
      });
      wx.showToast({ title: '已取关', icon: 'none' });
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },
});
