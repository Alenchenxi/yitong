import type { AppInstance } from '../../app';
import { listCircles, createPost, type Circle } from '../../services/confession';
import { uploadImages, uploadImage, uploadVideo } from '../../services/upload';

interface TagItem {
  name: string;
  selected: boolean;
}

interface PageData {
  circles: Circle[];
  selectedCircleId: string;
  selectedCircleName: string;
  content: string;
  hasContent: boolean; // content.trim() 预计算（WXML 不支持 .trim()）
  images: string[]; // 本地路径（选中后/上传中）
  uploading: boolean;
  submitting: boolean;
  showCirclePicker: boolean;
  tags: TagItem[]; // P0-09 标签（预设 + 选中态，WXML 不支持 indexOf 故预计算）
  tagCount: number; // 已选标签数
  isAnonymous: boolean; // P0-09 匿名/实名
  showEmoji: boolean; // P0-09 表情面板
  emojis: string[];
  video: { localPath: string; coverLocalPath: string; duration: number } | null; // P0-09 视频（与图片互斥）
}

const MAX_IMAGES = 9;
const MAX_CONTENT = 2000;
const MAX_TAGS = 5;
// 预设标签（P2 运营化时迁到后台配置）
const PRESET_TAGS = ['表白', '暗恋', '单身', '求脱单', '情感', '吐槽', '求助', '日常', '征友', '回忆'];
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😋', '🤔',
  '😴', '😭', '😡', '🥺', '😎', '🤩', '🥳', '😔', '❤️', '💔',
  '💕', '🌹', '👍', '👎', '🙏', '💪', '🎉', '🎂', '🎁', '✨',
];

Page({
  data: {
    circles: [],
    selectedCircleId: '',
    selectedCircleName: '选择圈子',
    content: '',
    hasContent: false,
    images: [],
    uploading: false,
    submitting: false,
    showCirclePicker: false,
    tags: PRESET_TAGS.map((name) => ({ name, selected: false })),
    tagCount: 0,
    isAnonymous: false,
    showEmoji: false,
    emojis: EMOJIS,
    video: null,
  } as PageData,

  cursor: 0,

  async onLoad(options: { circleId?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const circles = await listCircles().catch(() => []);
    let selectedId = options.circleId ?? '';
    let selectedName = '选择圈子';
    if (selectedId) {
      const c = circles.find((x) => x.id === selectedId);
      if (c) selectedName = `${c.icon ? c.icon + ' ' : ''}${c.name}`;
    } else if (circles.length > 0) {
      // 默认选「表白」圈（按名字匹配），否则第一个
      const prefer = circles.find((c) => c.name === '表白') ?? circles[0];
      if (prefer) {
        selectedId = prefer.id;
        selectedName = `${prefer.icon ? prefer.icon + ' ' : ''}${prefer.name}`;
      }
    }
    this.setData({
      circles,
      selectedCircleId: selectedId,
      selectedCircleName: selectedName,
    });
  },

  openCirclePicker() {
    this.setData({ showCirclePicker: true });
  },
  closeCirclePicker() {
    this.setData({ showCirclePicker: false });
  },
  pickCircle(e: WechatMiniprogram.TouchEvent) {
    const { id, name, icon } = e.currentTarget.dataset as { id: string; name: string; icon: string };
    this.setData({
      selectedCircleId: id,
      selectedCircleName: `${icon ? icon + ' ' : ''}${name}`,
      showCirclePicker: false,
    });
  },

  onContentInput(e: WechatMiniprogram.Input) {
    const v = e.detail.value;
    this.cursor = (e.detail as { cursor?: number }).cursor ?? v.length;
    this.setData({ content: v, hasContent: v.trim().length > 0 });
  },

  // 表情面板
  toggleEmoji() {
    this.setData({ showEmoji: !this.data.showEmoji });
  },
  insertEmoji(e: WechatMiniprogram.TouchEvent) {
    const emoji = e.currentTarget.dataset.emoji as string;
    const c = this.data.content;
    const pos = this.cursor;
    const next = c.slice(0, pos) + emoji + c.slice(pos);
    this.cursor = pos + emoji.length;
    this.setData({ content: next, hasContent: next.trim().length > 0 });
  },

  // 标签选择（多选，最多 MAX_TAGS）
  toggleTag(e: WechatMiniprogram.TouchEvent) {
    const name = e.currentTarget.dataset.name as string;
    const tags = this.data.tags.map((t) => ({ ...t }));
    const target = tags.find((t) => t.name === name);
    if (!target) return;
    if (target.selected) {
      target.selected = false;
    } else {
      const selectedCount = tags.filter((t) => t.selected).length;
      if (selectedCount >= MAX_TAGS) {
        wx.showToast({ title: `最多 ${MAX_TAGS} 个标签`, icon: 'none' });
        return;
      }
      target.selected = true;
    }
    this.setData({ tags, tagCount: tags.filter((t) => t.selected).length });
  },

  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous });
  },

  // 图片选择（与视频互斥）
  chooseImage() {
    if (this.data.video) {
      wx.showToast({ title: '视频与图片不可同时发布', icon: 'none' });
      return;
    }
    const remain = MAX_IMAGES - this.data.images.length;
    if (remain <= 0) {
      wx.showToast({ title: `最多 ${MAX_IMAGES} 张图`, icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res.tempFiles.map((f) => f.tempFilePath);
        this.setData({ images: [...this.data.images, ...paths] });
      },
    });
  },
  removeImage(e: WechatMiniprogram.TouchEvent) {
    const idx = e.currentTarget.dataset.idx as number;
    const imgs = [...this.data.images];
    imgs.splice(idx, 1);
    this.setData({ images: imgs });
  },
  previewImage(e: WechatMiniprogram.TouchEvent) {
    const { src } = e.currentTarget.dataset as { src: string };
    wx.previewImage({ current: src, urls: this.data.images });
  },

  // 视频选择（与图片互斥）
  chooseVideo() {
    if (this.data.images.length > 0) {
      wx.showToast({ title: '视频与图片不可同时发布', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      maxDuration: 60,
      sourceType: ['album', 'camera'],
      success: (res) => {
        const f = res.tempFiles[0];
        if (!f) return;
        this.setData({
          video: {
            localPath: f.tempFilePath,
            coverLocalPath: f.thumbTempFilePath ?? '',
            duration: f.duration ?? 0,
          },
        });
      },
    });
  },
  removeVideo() {
    this.setData({ video: null });
  },

  async submit() {
    if (this.data.submitting || this.data.uploading) return;
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '说点什么吧', icon: 'none' });
      return;
    }
    if (content.length > MAX_CONTENT) {
      wx.showToast({ title: `内容不超过 ${MAX_CONTENT} 字`, icon: 'none' });
      return;
    }
    if (!this.data.selectedCircleId) {
      wx.showToast({ title: '请选择圈子', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中...', mask: true });
    try {
      // 先上传图片（本地路径 -> COS URL）
      let imageUrls: string[] = [];
      if (this.data.images.length > 0) {
        this.setData({ uploading: true });
        wx.showLoading({ title: '上传图片...', mask: true });
        imageUrls = await uploadImages(this.data.images, 'posts');
        this.setData({ uploading: false });
      }
      // 上传视频 + 封面
      let videoUrl: string | undefined;
      let videoCover: string | undefined;
      if (this.data.video) {
        this.setData({ uploading: true });
        wx.showLoading({ title: '上传视频...', mask: true });
        videoUrl = await uploadVideo(this.data.video.localPath, 'posts');
        if (this.data.video.coverLocalPath) {
          videoCover = await uploadImage(this.data.video.coverLocalPath, 'posts');
        }
        this.setData({ uploading: false });
      }
      wx.showLoading({ title: '发布中...', mask: true });
      const selectedTagNames = this.data.tags.filter((t) => t.selected).map((t) => t.name);
      await createPost(this.data.selectedCircleId, {
        content,
        images: imageUrls,
        tags: selectedTagNames,
        isAnonymous: this.data.isAnonymous,
        videoUrl,
        videoCover,
      });
      wx.showToast({ title: '发布成功', icon: 'success' });
      // 返回上一页并刷新
      setTimeout(() => {
        const pages = getCurrentPages();
        const prev = pages[pages.length - 2];
        if (prev && typeof (prev as { onShow?: () => void }).onShow === 'function') {
          (prev as { onShow: () => void }).onShow();
        }
        wx.navigateBack();
      }, 600);
    } catch {
      // 已 toast
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false, uploading: false });
    }
  },
});
