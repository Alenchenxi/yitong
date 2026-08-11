import type { AppInstance } from '../../../app';
import {
  getAnonymousToken,
  getPost,
  hasAnonToken,
  getAnonId,
  toggleAnonPostLike,
  blockAnon,
  type AnonPostVo,
} from '../../../services/treehole';
import { formatTime } from '../../../utils/auth';

Page({
  data: {
    id: '',
    post: null as (AnonPostVo & { timeText: string; anonShort: string }) | null,
    isAuthor: false, // 当前匿名态是否为帖子作者
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
        isAuthor: getAnonId() === post.anonId,
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

  // 内容推广：作者提升曝光（付费置顶；树洞帖真实用户以 access token 付费，库内 AnonymousPost 仍 0 uid）
  onBoost() {
    const post = this.data.post;
    if (!post) return;
    wx.navigateTo({ url: `/pages/boost/index?type=anon_post&id=${post.id}` });
  },

  // P0-16 屏蔽此用户（帖子作者）：屏蔽后互相隔离，屏蔽即返回广场
  blockAuthor() {
    const post = this.data.post;
    if (!post) return;
    wx.showModal({
      title: '屏蔽此用户',
      content: '屏蔽后将互相看不到帖子、不再匹配、不能聊天。',
      confirmText: '屏蔽',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await blockAnon(post.anonId);
          wx.showToast({ title: '已屏蔽', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        } catch {
          /* toast */
        }
      },
    });
  },
});
