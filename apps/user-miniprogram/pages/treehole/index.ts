import type { AppInstance } from '../../app';
import {
  hasAnonToken,
  getAnonymousToken,
  listPosts,
  toggleAnonPostLike,
  type AnonPostVo,
} from '../../services/treehole';
import { formatTime } from '../../utils/auth';

type Tab = 'recommend' | 'latest' | 'mood';

const MOODS = ['开心', 'emo', '吐槽', '求安慰', '学习', '恋爱', '迷茫'];

Page({
  data: {
    posts: [] as Array<AnonPostVo & { timeText: string; anonShort: string }>,
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    anonNickname: '',
    activeTab: 'recommend' as Tab,
    moods: MOODS,
    selectedMood: '',
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try {
        const r = await getAnonymousToken();
        this.setData({ anonNickname: r.nickname });
      } catch {
        return;
      }
    } else if (!this.data.anonNickname) {
      getAnonymousToken()
        .then((r) => this.setData({ anonNickname: r.nickname }))
        .catch(() => {});
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
      const sort: 'latest' | 'recommend' = this.data.activeTab === 'recommend' ? 'recommend' : 'latest';
      const mood = this.data.activeTab === 'mood' && this.data.selectedMood ? this.data.selectedMood : undefined;
      const resp = await listPosts(this.data.nextCursor ?? undefined, sort, mood);
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

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const tab = (e.currentTarget.dataset.tab as Tab) ?? 'recommend';
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    this.reload();
  },

  // P0-13 情绪分类筛选（mood tab 下选情绪）
  pickMood(e: WechatMiniprogram.TouchEvent) {
    const mood = e.currentTarget.dataset.mood as string;
    this.setData({ selectedMood: mood === this.data.selectedMood ? '' : mood });
    this.reload();
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
  goProfile() {
    wx.navigateTo({ url: '/pages/treehole/profile/index' });
  },
  goMood() {
    wx.showToast({ title: '心情入口开发中', icon: 'none' });
  },
  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/treehole/detail/index?id=${id}` });
  },

  async onLike(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const idx = this.data.posts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const post = this.data.posts[idx];
    const nextLiked = !post.liked;
    const nextCount = post.likeCount + (nextLiked ? 1 : -1);
    this.setData({
      [`posts[${idx}].liked`]: nextLiked,
      [`posts[${idx}].likeCount`]: Math.max(0, nextCount),
    });
    try {
      await toggleAnonPostLike(id);
    } catch {
      this.setData({
        [`posts[${idx}].liked`]: post.liked,
        [`posts[${idx}].likeCount`]: post.likeCount,
      });
    }
  },
});
