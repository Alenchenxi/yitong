import type { AppInstance } from '../../../app';
import { createCommunity } from '../../../services/community';
import { uploadImage } from '../../../services/upload';

// 圈子类型（与后端 COMMUNITY_CATEGORIES 对齐）
const CATEGORIES = ['校园', '兴趣', '生活', '兼职'];

// 创建圈子：LOGO（可选）+ 名称 + 类型（必选）+ 所在地区 + 所在地点 + 简介（可选）
Page({
  data: {
    name: '',
    description: '',
    logo: '',
    categories: CATEGORIES,
    category: '', // 圈子类型（必选）
    region: '', // 所在地区（城市/校区）
    location: '', // 所在地点（具体地址/POI）
    uploading: false,
    submitting: false,
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value });
  },

  onDescInput(e: WechatMiniprogram.Input) {
    this.setData({ description: e.detail.value });
  },

  onRegionInput(e: WechatMiniprogram.Input) {
    this.setData({ region: e.detail.value });
  },

  onLocationInput(e: WechatMiniprogram.Input) {
    this.setData({ location: e.detail.value });
  },

  // 类型 chips：单选
  pickCategory(e: WechatMiniprogram.TouchEvent) {
    const cat = e.currentTarget.dataset.cat as string;
    this.setData({ category: cat });
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
    const category = this.data.category;
    const region = this.data.region.trim();
    const location = this.data.location.trim();
    if (!name) {
      wx.showToast({ title: '请输入圈子名称', icon: 'none' });
      return;
    }
    if (!category) {
      wx.showToast({ title: '请选择圈子类型', icon: 'none' });
      return;
    }
    if (!region) {
      wx.showToast({ title: '请输入所在地区', icon: 'none' });
      return;
    }
    if (!location) {
      wx.showToast({ title: '请输入所在地点', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const c = await createCommunity({
        name,
        logo: this.data.logo || undefined,
        description: this.data.description.trim() || undefined,
        category,
        region,
        location,
      });
      const app = getApp<AppInstance>();
      app.globalData.activeCommunityId = c.id;
      app.globalData.joinGate = false;
      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/square/index' }), 600);
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ submitting: false });
    }
  },
});
