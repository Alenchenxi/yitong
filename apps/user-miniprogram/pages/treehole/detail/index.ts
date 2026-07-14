import type { AppInstance } from '../../../app';
import {
  getAnonymousToken,
  getPost,
  hasAnonToken,
  toggleAnonPostLike,
  type AnonPostVo,
} from '../../../services/treehole';
import { formatTime } from '../../../utils/auth';

Page({
  data: {
    id: '',
    post: null as (AnonPostVo & { timeText: string; anonShort: string }) | null,
    loading: false,
  },

  async onLoad(query: Record<string, string | undefined>) {
    const id = query.id ?? '';
    this.setData({ id });
    await this.load();
  },

  async load() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!this.data.id) {
      wx.showToast({ title: '帖子不存在', icon: 'none' });
      return;
    }
    if (!hasAnonToken()) {
      try {
        await getAnonymousToken();
      } catch {
        return;
      }
    }
    this.setData({ loading: true });
    try {
      const post = await getPost(this.data.id);
      this.setData({
        post: {
          ...post,
          timeText: formatTime(post.createdAt),
          anonShort: post.anonId.slice(0, 10),
        },
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  async onLike() {
    const post = this.data.post;
    if (!post) return;
    const nextLiked = !post.liked;
    const nextCount = Math.max(0, post.likeCount + (nextLiked ? 1 : -1));
    this.setData({
      'post.liked': nextLiked,
      'post.likeCount': nextCount,
    });
    try {
      const r = await toggleAnonPostLike(post.id);
      this.setData({
        'post.liked': r.liked,
        'post.likeCount': r.likeCount,
      });
    } catch {
      this.setData({
        'post.liked': post.liked,
        'post.likeCount': post.likeCount,
      });
    }
  },
});
