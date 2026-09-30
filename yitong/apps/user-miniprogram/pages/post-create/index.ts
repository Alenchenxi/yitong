import type { AppInstance } from '../../app';
import { listCircles, createPost, editPost, type Circle, type PostVo } from '../../services/confession';
import { uploadImages, uploadImage, uploadVideo } from '../../services/upload';
import {
  bindAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../utils/anonymous-content';

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
  images: string[]; // 本地路径（选中后/上传中）；编辑模式下可能混存已上传 URL
  originalImages: string[]; // R2 编辑模式：draft 回填的已上传 URL（身份标识，区分需上传的本地路径）
  uploading: boolean;
  submitting: boolean;
  showCirclePicker: boolean;
  tags: TagItem[]; // P0-09 标签（预设 + 选中态，WXML 不支持 indexOf 故预计算）
  tagCount: number; // 已选标签数
  isAnonymous: boolean; // P0-09 匿名/实名
  showAnonymousPublish: boolean; // 隐藏匿名发布入口
  showEmoji: boolean; // P0-09 表情面板
  emojis: string[];
  video: { localPath: string; coverLocalPath: string; duration: number } | null; // P0-09 视频（与图片互斥）
  editId: string; // P1-10 编辑模式：被编辑帖子 id（空=新建）
  visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT'; // P1-11 可见性选择
  scheduleEnabled: boolean; // P2-06 定时发布开关
  publishAt: string; // P2-06 定时发布时间（显示用，YYYY-MM-DD HH:mm）
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
    selectedCircleName: '选择分类',
    content: '',
    hasContent: false,
    images: [],
    originalImages: [],
    uploading: false,
    submitting: false,
    showCirclePicker: false,
    tags: PRESET_TAGS.map((name) => ({ name, selected: false })),
    tagCount: 0,
    isAnonymous: false,
    showAnonymousPublish: false,
    showEmoji: false,
    emojis: EMOJIS,
    video: null,
    editId: '',
    visibility: 'PUBLIC',
    scheduleEnabled: false,
    publishAt: '',
  } as PageData,

  cursor: 0,

  async onLoad(options: { circleId?: string; editId?: string }) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    bindAnonymousContentVisibility(this, (enabled) => {
      this.updateAnonymousContentVisibility(enabled);
    });
    const showAnonymousPublish = await app.getAnonymousContentVisibility();
    this.updateAnonymousContentVisibility(showAnonymousPublish);
    const circles = await listCircles().catch(() => []);
    let selectedId = options.circleId ?? '';
    let selectedName = '选择分类';
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
    const initial: Partial<PageData> = {
      circles,
      selectedCircleId: selectedId,
      selectedCircleName: selectedName,
    };

    // P1-10 编辑模式：从 storage 取出被编辑帖
    if (options.editId) {
      const draft = wx.getStorageSync<PostVo | null>('yitong_edit_post_draft');
      if (draft && draft.id === options.editId) {
        const c = circles.find((x) => x.id === draft.circleId);
        if (c) {
          initial.selectedCircleId = c.id;
          initial.selectedCircleName = `${c.icon ? c.icon + ' ' : ''}${c.name}`;
        }
        initial.content = draft.content;
        initial.hasContent = draft.content.trim().length > 0;
        initial.images = draft.images ?? [];
        initial.originalImages = draft.images ?? [];
        if (showAnonymousPublish) {
          initial.isAnonymous = !!draft.isAnonymous;
        }
        initial.visibility = draft.visibility ?? 'PUBLIC';
        // 标记标签选中态
        const tags = PRESET_TAGS.map((name) => ({ name, selected: (draft.tags ?? []).includes(name) }));
        initial.tags = tags;
        initial.tagCount = tags.filter((t) => t.selected).length;
        initial.editId = draft.id;
        wx.removeStorageSync('yitong_edit_post_draft');
      }
    }

    this.setData(initial as PageData);
  },

  onUnload() {
    unbindAnonymousContentVisibility(this);
  },

  updateAnonymousContentVisibility(enabled: boolean) {
    this.setData({
      showAnonymousPublish: enabled,
      ...(!enabled ? { isAnonymous: false } : {}),
    });
  },

  // P1-11 可见性切换（公开/私密/草稿）
  setVisibility(e: WechatMiniprogram.TouchEvent) {
    const v = e.currentTarget.dataset.visibility as 'PUBLIC' | 'PRIVATE' | 'DRAFT';
    // P2-06 定时发布仅支持公开；切到非公开时关闭定时
    this.setData({ visibility: v, ...(v !== 'PUBLIC' ? { scheduleEnabled: false, publishAt: '' } : {}) });
  },

  // P2-06 定时发布开关
  toggleSchedule() {
    if (this.data.visibility !== 'PUBLIC' && !this.data.scheduleEnabled) {
      wx.showToast({ title: '仅公开帖支持定时发布', icon: 'none' });
      return;
    }
    this.setData({ scheduleEnabled: !this.data.scheduleEnabled, ...(this.data.scheduleEnabled ? { publishAt: '' } : {}) });
  },

  // P2-06 选择定时时间（datetime picker）
  onScheduleChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ publishAt: e.detail.value as string });
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
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中...', mask: true });
    // P2-06 定时发布：校验时间且须为未来
    let publishAtIso: string | undefined;
    if (this.data.scheduleEnabled && this.data.visibility === 'PUBLIC') {
      if (!this.data.publishAt) {
        wx.showToast({ title: '请选择定时发布时间', icon: 'none' });
        this.setData({ submitting: false });
        wx.hideLoading();
        return;
      }
      const t = new Date(this.data.publishAt.replace(/-/g, '/').replace(' ', 'T'));
      if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) {
        wx.showToast({ title: '定时时间须晚于当前', icon: 'none' });
        this.setData({ submitting: false });
        wx.hideLoading();
        return;
      }
      publishAtIso = t.toISOString();
    }
    try {
      // R2 按 originalImages 身份分区：已上传 URL 透传，仅本地路径上传（编辑模式 images 混存 URL+本地路径，
      //    旧逻辑对全数组调 uploadImages 会把 URL 当 filePath 传给 wx.uploadFile 必败；且旧 finalImages 会拼重复）
      const originalSet = new Set(this.data.originalImages);
      const keptUrls: string[] = [];
      const toUpload: string[] = [];
      for (const img of this.data.images) {
        if (originalSet.has(img)) keptUrls.push(img);
        else toUpload.push(img);
      }
      let uploadedUrls: string[] = [];
      if (toUpload.length > 0) {
        this.setData({ uploading: true });
        wx.showLoading({ title: '上传图片...', mask: true });
        uploadedUrls = await uploadImages(toUpload, 'posts');
        this.setData({ uploading: false });
      }
      const finalImageUrls = [...keptUrls, ...uploadedUrls];
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
      wx.showLoading({ title: this.data.editId ? '保存中...' : '发布中...', mask: true });
      const selectedTagNames = this.data.tags.filter((t) => t.selected).map((t) => t.name);
      if (this.data.editId) {
        await editPost(this.data.editId, {
          content,
          images: finalImageUrls,
          tags: selectedTagNames,
          isAnonymous: this.data.showAnonymousPublish && this.data.isAnonymous,
          videoUrl,
          videoCover,
          visibility: this.data.visibility,
        });
        const t = this.data.visibility === 'DRAFT' ? '已存为草稿' : this.data.visibility === 'PRIVATE' ? '已存为私密' : '已保存';
        wx.showToast({ title: t, icon: 'success' });
      } else {
        await createPost(this.data.selectedCircleId, {
          content,
          images: finalImageUrls,
          tags: selectedTagNames,
          isAnonymous: this.data.showAnonymousPublish && this.data.isAnonymous,
          videoUrl,
          videoCover,
          visibility: this.data.visibility,
          publishAt: publishAtIso,
        });
        const t = publishAtIso
          ? '已设置定时发布'
          : this.data.visibility === 'DRAFT' ? '已存为草稿' : this.data.visibility === 'PRIVATE' ? '已存为私密' : '发布成功';
        wx.showToast({ title: t, icon: 'success' });
      }
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
