import type { AppInstance } from '../../../app';
import { createAnonGroup, type AnonGroupVo } from '../../../services/treehole';
import { uploadImage } from '../../../services/upload';

const PRESET_TAGS = ['情感', '学习', '游戏', '音乐', '电影', '运动', '美食', '树洞', '闲聊'];
const PRESET_EMOJIS = ['🌙', '⭐', '🌸', '🍀', '🌊', '☁️', '🔥', '🎵', '📚', '🎮'];

Page({
  data: {
    name: '',
    description: '',
    announcement: '',
    maxMembers: 100,
    isPrivate: false,
    tags: PRESET_TAGS.map((t) => ({ name: t, selected: false })),
    emojis: PRESET_EMOJIS,
    avatarEmoji: '🌙',
    avatarUrl: '' as string,
    submitting: false,
  },

  async onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },

  onInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as string;
    this.setData({ [field]: e.detail.value } as Record<string, string>);
  },

  pickEmoji(e: WechatMiniprogram.TouchEvent) {
    const emoji = e.currentTarget.dataset.emoji as string;
    this.setData({ avatarEmoji: emoji, avatarUrl: '' });
  },

  // B2 群头像：上传图片（用 url 模式，清除 emoji）
  async pickAvatarImage() {
    try {
      const res: WechatMiniprogram.ChooseMediaSuccessCallbackResult = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        } as any);
      });
      const f = res.tempFiles?.[0];
      if (!f) return;
      wx.showLoading({ title: '上传中...', mask: true });
      const url = await uploadImage(f.tempFilePath, 'anon');
      wx.hideLoading();
      this.setData({ avatarUrl: url, avatarEmoji: '' });
    } catch {
      wx.hideLoading();
    }
  },

  toggleTag(e: WechatMiniprogram.TouchEvent) {
    const name = e.currentTarget.dataset.name as string;
    const tags = this.data.tags.map((t) => (t.name === name ? { ...t, selected: !t.selected } : t));
    const selectedCount = tags.filter((t) => t.selected).length;
    if (selectedCount > 5) {
      wx.showToast({ title: '最多 5 个标签', icon: 'none' });
      return;
    }
    this.setData({ tags });
  },

  togglePrivate() {
    this.setData({ isPrivate: !this.data.isPrivate });
  },

  async submit() {
    const name = this.data.name.trim();
    if (!name || name.length > 30) {
      wx.showToast({ title: '请输入 1-30 字群名称', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    wx.showLoading({ title: '创建中...', mask: true });
    try {
      const g = await createAnonGroup({
        name,
        description: this.data.description.trim() || undefined,
        announcement: this.data.announcement.trim() || undefined,
        tags: this.data.tags.filter((t) => t.selected).map((t) => t.name),
        maxMembers: this.data.maxMembers,
        isPrivate: this.data.isPrivate,
        avatarUrl: this.data.avatarUrl || undefined,
      } as Parameters<typeof createAnonGroup>[0]);
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/treehole/group-detail/index?id=${g.id}` });
      }, 600);
    } catch {
      /* toast */
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },
});
