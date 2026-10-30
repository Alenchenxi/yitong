import type { AppInstance } from '../../../app';
import { hasAnonToken, getAnonymousToken, createPost, updateAnonPost, getAnonTags, type AnonPostVo } from '../../../services/treehole';
import { uploadImages, uploadImage, uploadVideo } from '../../../services/upload';
import { chooseLocation } from '../../../utils/choose-location';
import {
  bindAnonymousContentPageGuard,
  requireAnonymousContentVisibility,
  unbindAnonymousContentVisibility,
} from '../../../utils/anonymous-content';

// P1-13：mood 从标签库加载；库为空回退内置
const FALLBACK_MOODS = ['开心', 'emo', '吐槽', '求安慰', '学习', '恋爱', '迷茫'];
const MAX_IMAGE_COUNT = 9; // P2-83 对齐表白墙九图（原 3）
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_DURATION = 120; // P2-83 视频最长 120s（2 分钟内），相册/拍摄统一以回调 duration 校验
const CAMERA_MAX_DURATION = 60; // 微信 chooseMedia 拍摄时长 API 上限 60s（< 2 分钟，天然满足）

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
    chosenLocation: null as { name: string; address: string } | null, // CR-006 发布地（可选）
    visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE', // CR-007 公开/私密
    editId: '', // CR-007 编辑模式（详情页/我的树洞带 editId 进入）
    originalImages: [] as string[], // CR-007 编辑模式：已上传 URL 分区（透传，不重传）
    keptVideoUrl: '', // CR-007 编辑模式：保留原视频（未替换则透传）
    keptVideoCover: '',
  },

  async onLoad(options: Record<string, string | undefined>) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    bindAnonymousContentPageGuard(this);
    if (!hasAnonToken()) {
      try { await getAnonymousToken(); } catch { return; }
    }
    let moods = FALLBACK_MOODS;
    // P1-13 从标签库拉 mood 选项
    try {
      const tags = await getAnonTags();
      if (tags.mood.length > 0) {
        moods = tags.mood.map((t) => t.name);
      }
    } catch {
      /* 用 fallback */
    }
    // CR-007 编辑模式：从 storage 取被编辑帖（详情页/我的树洞写入）
    if (options.editId) {
      const draft = wx.getStorageSync<AnonPostVo | null>('yitong_edit_anon_post_draft');
      if (draft && draft.id === options.editId) {
        if (draft.mood && !moods.includes(draft.mood)) {
          moods = [...moods, draft.mood];
        }
        wx.setNavigationBarTitle({ title: '编辑动态' });
        this.setData({
          editId: draft.id,
          content: draft.content,
          selectedMood: draft.mood ?? '',
          imagePaths: draft.images ?? [],
          originalImages: [...(draft.images ?? [])],
          keptVideoUrl: draft.videoUrl ?? '',
          keptVideoCover: draft.videoCover ?? '',
          visibility: draft.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
        });
      }
    }
    this.setData({ moods });
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

  // CR-007 公开/私密切换
  setVisibility(e: WechatMiniprogram.TouchEvent) {
    const v = e.currentTarget.dataset.visibility as 'PUBLIC' | 'PRIVATE';
    this.setData({ visibility: v });
  },

  // CR-006 发布地：地图选点（复用 P2-80 封装，取消/失败静默）；可清除，不选则不带位置
  async pickLocation() {
    const loc = await chooseLocation();
    if (loc) {
      this.setData({ chosenLocation: { name: loc.name, address: loc.address } });
    }
  },

  clearLocation() {
    this.setData({ chosenLocation: null });
  },

  // P2-83 长按任意媒体：切换删除态（右上角删除按钮显隐，删除后网格自动重排）
  toggleDelete() {
    this.setData({ showDelete: !this.data.showDelete });
  },

  // 图片选择（与视频互斥）
  chooseImages() {
    if (this.data.video || this.data.keptVideoUrl) {
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
      maxDuration: CAMERA_MAX_DURATION,
      sourceType: ['album', 'camera'],
      success: ({ tempFiles }) => {
        const f = tempFiles[0];
        if (!f) return;
        if ((f.duration ?? 0) > MAX_VIDEO_DURATION) {
          wx.showToast({ title: '视频不能超过 2 分钟', icon: 'none' });
          return;
        }
        this.setData({
          video: {
            localPath: f.tempFilePath,
            coverLocalPath: f.thumbTempFilePath ?? '',
            duration: f.duration ?? 0,
          },
          keptVideoUrl: '', // CR-007 替换后不再保留原视频
          keptVideoCover: '',
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
    this.setData({ video: null, keptVideoUrl: '', keptVideoCover: '', showDelete: false });
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
      title: this.data.editId ? '保存中...' : video ? '上传视频...' : this.data.imagePaths.length > 0 ? '上传图片...' : '发布中...',
      mask: true,
    });
    let published = false;
    let failedMessage = '';
    try {
      // P2-83 图片/视频互斥：有视频只传视频 + 封面，否则传图片
      // CR-007 编辑模式按 originalImages 分区：已上传 URL 透传，仅新选本地路径上传
      const originalSet = new Set(this.data.originalImages);
      const keptUrls: string[] = [];
      const toUpload: string[] = [];
      for (const img of this.data.imagePaths) {
        if (originalSet.has(img)) keptUrls.push(img);
        else toUpload.push(img);
      }
      let images: string[] | undefined;
      let videoUrl: string | undefined;
      let videoCover: string | undefined;
      if (video) {
        videoUrl = await uploadVideo(video.localPath, 'anon');
        if (video.coverLocalPath) {
          wx.showLoading({ title: '上传封面...', mask: true });
          videoCover = await uploadImage(video.coverLocalPath, 'anon');
        }
      } else if (this.data.keptVideoUrl) {
        // CR-007 编辑未替换视频：原视频透传
        videoUrl = this.data.keptVideoUrl;
        videoCover = this.data.keptVideoCover || undefined;
      } else if (this.data.imagePaths.length > 0) {
        images = [...keptUrls, ...(toUpload.length > 0 ? await uploadImages(toUpload, 'anon') : [])];
      }
      wx.showLoading({ title: this.data.editId ? '保存中...' : '发布中...', mask: true });
      const payload = {
        content,
        mood: this.data.selectedMood || undefined,
        images,
        videoUrl,
        videoCover,
        // CR-006 发布地：仅选中时提交地址文本（服务端解析市/区；不存坐标）
        locationAddress: this.data.chosenLocation?.address,
        visibility: this.data.visibility,
      };
      if (this.data.editId) {
        await updateAnonPost(this.data.editId, payload);
      } else {
        await createPost(payload);
      }
      published = true;
    } catch (e) {
      // 服务层已 toast，但会被下方 hideLoading 吞掉（toast/loading 共用原生视图）——hideLoading 后补一次提示
      failedMessage = e instanceof Error && e.message ? e.message : '发布失败，请稍后重试';
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
    if (published) {
      wx.showToast({ title: this.data.editId ? '已保存' : '发布成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } else if (failedMessage) {
      wx.showToast({ title: failedMessage, icon: 'none' });
    }
  },
});
