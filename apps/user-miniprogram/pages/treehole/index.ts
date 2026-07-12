import type { AppInstance } from '../../app';
import {
  hasAnonToken,
  getAnonymousToken,
  listPosts,
  type AnonPostVo,
} from '../../services/treehole';
import { formatTime } from '../../utils/auth';

Page({
  data: {
    posts: [] as Array<AnonPostVo & { timeText: string; anonShort: string }>,
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try {
        await getAnonymousToken();
      } catch {
        return;
      }
    }
    if (this.data.posts.length === 0) this.reload();
  },

  async reload() {
    this.setData({ posts: [], nextCursor: null, hasMore: true });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const resp = await listPosts(this.data.nextCursor ?? undefined);
      this.setData({
        posts: [
          ...this.data.posts,
          ...resp.list.map((p) => ({
            ...p,
            timeText: formatTime(p.createdAt),
            anonShort: p.anonId.slice(0, 10),
          })),
        ],
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
    this.loadMore();
  },
  goPost() {
    wx.navigateTo({ url: '/pages/treehole/post/index' });
  },
  goMatch() {
    wx.navigateTo({ url: '/pages/treehole/chat/index' });
  },
  goParty() {
    wx.navigateTo({ url: '/pages/treehole/party/index' });
  },
});
