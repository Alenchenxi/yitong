import type { AppInstance } from '../../app';
import { listCircles, createPost, type Circle } from '../../services/confession';
import { uploadImages } from '../../services/upload';

interface PageData {
  circles: Circle[];
  selectedCircleId: string;
  selectedCircleName: string;
  content: string;
  images: string[]; // 本地路径（选中后/上传中）
  uploading: boolean;
  submitting: boolean;
  showCirclePicker: boolean;
}

const MAX_IMAGES = 9;
const MAX_CONTENT = 2000;

Page({
  data: {
    circles: [],
    selectedCircleId: '',
    selectedCircleName: '选择圈子',
    content: '',
    images: [],
    uploading: false,
    submitting: false,
    showCirclePicker: false,
  } as PageData,

  async onLoad(options: { circleId?: string }) {
    const app = getApp<AppInstance>();
    try {
      await app.waitLogin();
    } catch {
      return;
    }
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
    this.setData({ content: e.detail.value });
  },

  chooseImage() {
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
      // 先上传图片（本地路径 → COS URL）
      let urls: string[] = [];
      if (this.data.images.length > 0) {
        this.setData({ uploading: true });
        wx.showLoading({ title: '上传图片...', mask: true });
        urls = await uploadImages(this.data.images);
        this.setData({ uploading: false });
        wx.showLoading({ title: '发布中...', mask: true });
      }
      await createPost(this.data.selectedCircleId, content, urls);
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
