import type { AppInstance } from '../../../app';
import { getActivityTopic, toggleLike, type PostVo } from '../../../services/confession';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

Page({
  data: {
    topic: null as { id: string; title: string; description: string | null; coverUrl: string | null } | null,
    posts: [] as PostVo[],
    loading: false,
    anonymousContentEnabled: false,
  },
  topicId: '',

  onLoad(options: { id?: string }) {
    bindAnonymousContentVisibility(this, (enabled) => {
      this.updateAnonymousContentVisibility(enabled);
    });
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.topicId = options.id;
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    this.setData({
      anonymousContentEnabled: enabled,
      posts: enabled ? this.data.posts : this.data.posts.filter((post) => !post.isAnonymous),
    });
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.updateAnonymousContentVisibility(await app.getAnonymousContentVisibility());
    if (this.topicId) await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await getActivityTopic(this.topicId);
      this.setData({
        topic: r.topic,
        posts: this.data.anonymousContentEnabled
          ? r.posts
          : r.posts.filter((post) => !post.isAnonymous),
      });
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

  // 转发给微信好友：post-card 转发按钮触发（data-id 定位），无 id 时 fallback 本页
  onShareAppMessage(e: { target?: { dataset?: { id?: string } } }) {
    const id = e?.target?.dataset?.id ?? '';
    return {
      title: this.data.topic?.title ? `#${this.data.topic.title}#` : '活动专题',
      path: id ? `/pages/post-detail/index?id=${id}` : `/pages/confession/activity-detail/index?id=${this.topicId}`,
    };
  },
});
