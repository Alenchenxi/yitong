import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, createPost } from '../../../services/treehole';

Page({
  data: { content: '', submitting: false },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
    }
  },

  onInput(e: WechatMiniprogram.Input) { this.setData({ content: e.detail.value }); },

  async submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (!content) { wx.showToast({ title: '说点什么吧', icon: 'none' }); return; }
    this.setData({ submitting: true });
    try {
      await createPost({ content });
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {} finally { this.setData({ submitting: false }); }
  },
});
