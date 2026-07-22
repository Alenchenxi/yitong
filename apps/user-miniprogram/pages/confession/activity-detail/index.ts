import type { AppInstance } from '../../../app';
import { getActivityTopic, toggleLike, type PostVo } from '../../../services/confession';

Page({
  data: {
    topic: null as { id: string; title: string; description: string | null; coverUrl: string | null } | null,
    posts: [] as PostVo[],
    loading: false,
  },
  topicId: '',

  onLoad(options: { id?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.topicId = options.id;
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.topicId) await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await getActivityTopic(this.topicId);
      this.setData({ topic: r.topic, posts: r.posts });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  async onLike(e: WechatMiniprogram.CustomEvent) {
    const { id } = e.detail as { id: string };
    const idx = this.data.posts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const p = this.data.posts[idx];
    const nextLiked = !p.liked;
    this.setData({
      [`posts[${idx}].liked`]: nextLiked,
      [`posts[${idx}].likeCount`]: Math.max(0, p.likeCount + (nextLiked ? 1 : -1)),
    });
    try {
      await toggleLike(id);
    } catch {
      this.setData({ [`posts[${idx}].liked`]: p.liked, [`posts[${idx}].likeCount`]: p.likeCount });
    }
  },
});
