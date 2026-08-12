import type { AppInstance } from '../../../app';
import { createCommunity } from '../../../services/community';
import { uploadImage } from '../../../services/upload';

// 创建圈子：名称必填 + LOGO（可选上传）+ 简介（可选）
Page({
  data: {
    name: '',
    description: '',
    logo: '',
    uploading: false,
    submitting: false,
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value });
  },

  onDescInput(e: WechatMiniprogram.Input) {
    this.setData({ description: e.detail.value });
  },

  chooseLogo() {
    if (this.data.uploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        this.setData({ uploading: true });
        uploadImage(file.tempFilePath, 'community')
          .then((url) => this.setData({ logo: url }))
          .catch(() => {})
          .finally(() => this.setData({ uploading: false }));
      },
    });
  },

  async submit() {
    const name = this.data.name.trim();
    if (!name) {
      wx.showToast({ title: '请输入圈子名称', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const c = await createCommunity({
        name,
        logo: this.data.logo || undefined,
        description: this.data.description.trim() || undefined,
      });
      const app = getApp<AppInstance>();
      app.globalData.activeCommunityId = c.id;
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
