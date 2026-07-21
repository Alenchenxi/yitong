import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, createPost } from '../../../services/treehole';

const MOODS = ['开心', 'emo', '吐槽', '求安慰', '学习', '恋爱', '迷茫'];

Page({
  data: {
    content: '',
    submitting: false,
    moods: MOODS,
    selectedMood: '',
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
    }
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value });
  },

  pickMood(e: WechatMiniprogram.TouchEvent) {
    const mood = e.currentTarget.dataset.mood as string;
    this.setData({ selectedMood: mood === this.data.selectedMood ? '' : mood });
  },

  async submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '说点什么吧', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await createPost({ content, mood: this.data.selectedMood || undefined });
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      /* toast */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
