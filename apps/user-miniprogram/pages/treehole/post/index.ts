import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, createPost, getAnonTags } from '../../../services/treehole';
import { uploadImages } from '../../../services/upload';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

// P1-13：mood 从标签库加载；库为空回退内置
const FALLBACK_MOODS = ['开心', 'emo', '吐槽', '求安慰', '学习', '恋爱', '迷茫'];
const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

Page({
  data: {
    content: '',
    submitting: false,
    moods: FALLBACK_MOODS,
    selectedMood: '',
    imagePaths: [] as string[],
    maxImageCount: MAX_IMAGE_COUNT,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    bindAnonymousContentPageGuard(this);
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
    }
    // P1-13 从标签库拉 mood 选项
    try {
      const tags = await getAnonTags();
      if (tags.mood.length > 0) {
        this.setData({ moods: tags.mood.map((t) => t.name) });
      }
    } catch {
      /* 用 fallback */
    }
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ content: e.detail.value });
  },

  pickMood(e: WechatMiniprogram.TouchEvent) {
    const mood = e.currentTarget.dataset.mood as string;
    this.setData({ selectedMood: mood === this.data.selectedMood ? '' : mood });
  },

  chooseImages() {
    const remaining = MAX_IMAGE_COUNT - this.data.imagePaths.length;
    if (remaining <= 0) return;

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        const validPaths = tempFiles
          .filter((file) => file.size <= MAX_IMAGE_SIZE)
          .map((file) => file.tempFilePath);
        if (validPaths.length !== tempFiles.length) {
          wx.showToast({ title: '单张图片不能超过 5MB', icon: 'none' });
        }
        if (validPaths.length > 0) {
          this.setData({
            imagePaths: [...this.data.imagePaths, ...validPaths].slice(0, MAX_IMAGE_COUNT),
          });
        }
      },
    });
  },

  previewImage(e: WechatMiniprogram.TouchEvent) {
    const src = e.currentTarget.dataset.src as string;
    if (!src) return;
    wx.previewImage({ current: src, urls: this.data.imagePaths });
  },

  removeImage(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      imagePaths: this.data.imagePaths.filter((_, itemIndex) => itemIndex !== index),
    });
  },

  async submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '说点什么吧', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({
      title: this.data.imagePaths.length > 0 ? '上传图片...' : '发布中...',
      mask: true,
    });
    let published = false;
    try {
      const images = this.data.imagePaths.length > 0
        ? await uploadImages(this.data.imagePaths, 'anon')
        : undefined;
      if (images) wx.showLoading({ title: '发布中...', mask: true });
      await createPost({ content, mood: this.data.selectedMood || undefined, images });
      published = true;
    } catch {
      /* toast */
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
    if (published) {
      wx.showToast({ title: '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    }
  },
});
