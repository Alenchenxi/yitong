import { getJobCategories, type JobCategoryGridItem } from '../../../services/job';

// 智能生成流程(2026-08-10):类别网格选择页(截图 1)
// 选中类别 + 工作地点(强制地图) -> post-create 智能生成页
Page({
  data: {
    categories: [] as JobCategoryGridItem[],
    selectedKey: '' as string,
    location: {
      address: '',
      poiId: '',
      lng: 0,
      lat: 0,
      city: '',
    } as {
      address: string;
      poiId: string;
      lng: number;
      lat: number;
      city: string;
    },
    canSubmit: false,
  },

  onLoad() {
    this.loadCategories();
  },

  // 监听 post-create / location-picker 回填
  onShow() {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    const incoming = (cur && (cur as { options?: Record<string, string> }).options) || {};
    if (incoming.selectedKey) {
      this.setData({ selectedKey: incoming.selectedKey });
    }
    if (incoming.poiId && incoming.lng && incoming.lat) {
      this.setData({
        location: {
          address: incoming.address ?? '',
          poiId: incoming.poiId,
          lng: Number(incoming.lng),
          lat: Number(incoming.lat),
          city: incoming.city ?? '',
        },
      });
    }
    this.refreshCanSubmit();
  },

  async loadCategories() {
    try {
      const data = await getJobCategories();
      this.setData({ categories: data.items });
    } catch {
      wx.showToast({ title: '类别加载失败', icon: 'none' });
    }
  },

  onPickCategory(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    this.setData({ selectedKey: key });
    this.refreshCanSubmit();
  },

  onPickLocation() {
    if (!this.data.selectedKey) {
      wx.showToast({ title: '请先选择职位类别', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/job/location-picker/index?selectedKey=${this.data.selectedKey}` });
  },

  refreshCanSubmit() {
    const ok = !!this.data.selectedKey && !!this.data.location.poiId;
    this.setData({ canSubmit: ok });
  },

  onNext() {
    if (!this.data.canSubmit) return;
    const { selectedKey, location } = this.data;
    const q =
      `selectedKey=${encodeURIComponent(selectedKey)}` +
      `&address=${encodeURIComponent(location.address)}` +
      `&poiId=${encodeURIComponent(location.poiId)}` +
      `&lng=${location.lng}&lat=${location.lat}` +
      `&city=${encodeURIComponent(location.city)}`;
    wx.navigateTo({ url: `/pages/job/post-create/index?${q}` });
  },
});