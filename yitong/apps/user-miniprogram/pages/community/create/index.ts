import type { AppInstance } from '../../../app';
import { createCommunity } from '../../../services/community';
import { uploadImage } from '../../../services/upload';
import { chooseLocation } from '../../../utils/choose-location';

// 圈子类型（与后端 COMMUNITY_CATEGORIES 对齐）
const CATEGORIES = ['校园', '兴趣', '生活', '兼职'];

// 创建圈子：背景图/LOGO（可选）+ 名称 + 类型（必选）+ 所在地区 + 所在地点 + 简介（可选）
Page({
  data: {
    name: '',
    description: '',
    logo: '',
    backgroundImage: '',
    categories: CATEGORIES,
    category: '', // 圈子类型（必选）
    region: '', // 所在地区（picker mode=region 省市区选择，如「浙江省杭州市西湖区」）
    location: '', // 所在地点（P2-79:wx.chooseLocation 地图选点,name+address 纯文本落库,坐标不存）
    uploading: false,
    backgroundUploading: false,
    submitting: false,
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value });
  },

  onDescInput(e: WechatMiniprogram.Input) {
    this.setData({ description: e.detail.value });
  },

  // 类型 chips：单选
  pickCategory(e: WechatMiniprogram.TouchEvent) {
    const cat = e.currentTarget.dataset.cat as string;
    this.setData({ category: cat });
  },

  // 所在地区：微信原生省市区三级选择器（region = 无空格拼接，如「浙江省杭州市西湖区」）
  onRegionChange(e: WechatMiniprogram.PickerChange) {
    const value = e.detail.value as unknown as string[];
    const [province = '', city = '', district = ''] = value;
    this.setData({ region: [province, city, district].filter(Boolean).join('') });
  },

  // P2-79 去百度地图:微信原生地图选点(取消/失败静默保持原状态)
  async onChooseLocation() {
    const loc = await chooseLocation();
    if (!loc) return;
    this.setData({ location: `${loc.name} ${loc.address}`.trim() });
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

  chooseBackground() {
    if (this.data.backgroundUploading) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        this.setData({ backgroundUploading: true });
        uploadImage(file.tempFilePath, 'community')
          .then((url) => this.setData({ backgroundImage: url }))
          .catch(() => {})
          .finally(() => this.setData({ backgroundUploading: false }));
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
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    if (!location) {
      wx.showToast({ title: '请选择所在地点', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const c = await createCommunity({
        name,
        logo: this.data.logo || undefined,
        backgroundImage: this.data.backgroundImage || undefined,
        description: this.data.description.trim() || undefined,
        category,
        region,
        location,
      });
      const app = getApp<AppInstance>();
      // P2-26: 审核开关开启 → status=PENDING，不切 activeCommunityId，跳到我的圈子-待审核
      if (c.pending) {
        wx.showToast({ title: '已提交，等待审核', icon: 'none', duration: 1500 });
        setTimeout(() => wx.reLaunch({ url: '/pages/community/mine/index?tab=pending' }), 600);
        return;
      }
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
