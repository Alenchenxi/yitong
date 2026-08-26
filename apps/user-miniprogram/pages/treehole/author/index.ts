import type { AppInstance } from '../../../app';
import {
  getAnonymousToken,
  getAnonAuthor,
  hasAnonToken,
  listAnonAuthorPosts,
  startAnonAuthorChat,
  toggleAnonPostLike,
  type AnonAuthorVo,
  type AnonPostVo,
} from '../../../services/treehole';
import { formatTime } from '../../../utils/auth';

type AuthorView = AnonAuthorVo & { displayTags: string[] };
type AuthorPostView = AnonPostVo & { timeText: string };

Page({
  data: {
    anonId: '',
    author: null as AuthorView | null,
    posts: [] as AuthorPostView[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: true,
    loadingMore: false,
    chatting: false,
    loadFailed: false,
  },

  async onLoad(query: { anonId?: string }) {
    let anonId = '';
    try {
      anonId = decodeURIComponent(query.anonId ?? '').trim();
    } catch {
      // Invalid route input is handled by the empty state below.
    }
    this.setData({ anonId });
    await this.loadPage();
  },

  async loadPage() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!this.data.anonId) {
      this.setData({ loading: false, loadFailed: true });
      return;
    }
    this.setData({ loading: true, loadFailed: false, posts: [], nextCursor: null, hasMore: true });
    try {
      if (!hasAnonToken()) await getAnonymousToken();
      const author = await getAnonAuthor(this.data.anonId);
      this.setData({
        author: {
          ...author,
          displayTags: [...new Set([...author.personalityTags, ...author.interestTags])],
        },
      });
      await this.loadMore();
    } catch {
      this.setData({ loadFailed: true });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.anonId) return;
    this.setData({ loadingMore: true });
    try {
      const result = await listAnonAuthorPosts(this.data.anonId, this.data.nextCursor ?? undefined);
      const views = result.list.map((post) => ({ ...post, timeText: formatTime(post.createdAt) }));
      this.setData({
        posts: [...this.data.posts, ...views],
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      });
    } catch {
      if (this.data.posts.length === 0) this.setData({ loadFailed: true });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  onPullDownRefresh() {
    this.loadPage();
  },

  onReachBottom() {
    this.loadMore();
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/treehole/detail/index?id=${encodeURIComponent(id)}` });
  },

  async onLike(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const idx = this.data.posts.findIndex((post) => post.id === id);
    if (idx < 0) return;
    const post = this.data.posts[idx];
    const liked = !post.liked;
    this.setData({
      [`posts[${idx}].liked`]: liked,
      [`posts[${idx}].likeCount`]: Math.max(0, post.likeCount + (liked ? 1 : -1)),
    });
    try {
      const result = await toggleAnonPostLike(id);
      this.setData({
        [`posts[${idx}].liked`]: result.liked,
        [`posts[${idx}].likeCount`]: result.likeCount,
      });
    } catch {
      this.setData({
        [`posts[${idx}].liked`]: post.liked,
        [`posts[${idx}].likeCount`]: post.likeCount,
      });
    }
  },

  async startChat() {
    if (this.data.chatting || this.data.author?.isSelf) return;
    this.setData({ chatting: true });
    wx.showLoading({ title: '正在进入聊天...', mask: true });
    try {
      const result = await startAnonAuthorChat(this.data.anonId);
      if (result.waiting || !result.matchId || !result.peerAnonId) {
        throw new Error('直接聊天会话无效');
      }
      wx.navigateTo({
        url: `/pages/treehole/chat/index?matchId=${encodeURIComponent(result.matchId)}&peerAnonId=${encodeURIComponent(result.peerAnonId)}`,
      });
    } catch {
      wx.showToast({ title: '暂时无法发起聊天', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ chatting: false });
    }
  },
});
