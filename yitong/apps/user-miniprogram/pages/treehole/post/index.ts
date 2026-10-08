import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, createPost, getAnonTags } from '../../../services/treehole';
import { uploadImages, uploadImage, uploadVideo } from '../../../services/upload';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

// P1-13：mood 从标签库加载；库为空回退内置
const FALLBACK_MOODS = ['开心', 'emo', '吐槽', '求安慰', '学习', '恋爱', '迷茫'];
const MAX_IMAGE_COUNT = 9; // P2-83 对齐表白墙九图（原 3）
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_DURATION = 60; // P2-83 视频最长 60s，与表白墙发布一致

interface VideoDraft {
  localPath: string;
  coverLocalPath: string;
  duration: number;
}

Page({
  data: {
    content: '',
    submitting: false,
    moods: FALLBACK_MOODS,
    selectedMood: '',
    imagePaths: [] as string[],
    maxImageCount: MAX_IMAGE_COUNT,
    video: null as VideoDraft | null, // P2-83 视频（与图片互斥）
    showDelete: false, // P2-83 朋友圈式：长按媒体呼出/收起右上角删除按钮
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

  // P2-83 长按任意媒体：切换删除态（右上角删除按钮显隐，删除后网格自动重排）
  toggleDelete() {
    this.setData({ showDelete: !this.data.showDelete });
  },

  // 图片选择（与视频互斥）
  chooseImages() {
    if (this.data.video) {
      wx.showToast({ title: '视频与图片不可同时发布', icon: 'none' });
      return;
    }
    const remaining = MAX_IMAGE_COUNT - this.data.imagePaths.length;
    if (remaining <= 0) {
      wx.showToast({ title: `最多 ${MAX_IMAGE_COUNT} 张图`, icon: 'none' });
      return;
    }

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

  // P2-83 视频选择（与图片互斥，同表白墙）
  chooseVideo() {
    if (this.data.imagePaths.length > 0) {
      wx.showToast({ title: '视频与图片不可同时发布', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: MAX_VIDEO_DURATION,
      sourceType: ['album', 'camera'],
      success: ({ tempFiles }) => {
        const f = tempFiles[0];
        if (!f) return;
        this.setData({
          video: {
            localPath: f.tempFilePath,
            coverLocalPath: f.thumbTempFilePath ?? '',
            duration: f.duration ?? 0,
          },
          showDelete: false,
        });
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

  removeVideo() {
    this.setData({ video: null, showDelete: false });
  },

  async submit() {
    if (this.data.submitting) return;
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '说点什么吧', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    const video = this.data.video;
    wx.showLoading({
      title: video ? '上传视频...' : this.data.imagePaths.length > 0 ? '上传图片...' : '发布中...',
      mask: true,
    });
    let published = false;
    try {
      // P2-83 图片/视频互斥：有视频只传视频 + 封面，否则传图片
      let images: string[] | undefined;
      let videoUrl: string | undefined;
      let videoCover: string | undefined;
      if (video) {
        videoUrl = await uploadVideo(video.localPath, 'anon');
        if (video.coverLocalPath) {
          wx.showLoading({ title: '上传封面...', mask: true });
          videoCover = await uploadImage(video.coverLocalPath, 'anon');
        }
      } else if (this.data.imagePaths.length > 0) {
        images = await uploadImages(this.data.imagePaths, 'anon');
      }
      wx.showLoading({ title: '发布中...', mask: true });
      await createPost({ content, mood: this.data.selectedMood || undefined, images, videoUrl, videoCover });
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
