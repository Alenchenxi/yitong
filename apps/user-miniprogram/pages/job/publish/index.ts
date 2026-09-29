import { getJobCategories, type JobCategoryGridItem } from '../../../services/job';
import { chooseLocation } from '../../../utils/choose-location';
import { buildJobCommunityPicker, listCommunities, type CommunityVo } from '../../../services/community';
import type { AppInstance } from '../../../app';

interface ChosenLocationState {
  name: string;
  address: string;
  lng: number;
  lat: number;
}

// 岗位发布同页入口(2026-08-11 建立;P2-79 去百度地图重构):
// 类别网格 + 微信原生地图选点(wx.chooseLocation,无 AK 依赖)同页。
// 交互:
//  1. 点「地图选点」→ wx.chooseLocation(自带地图/搜索/定位,隐私弹窗框架自动处理)
//  2. 选点成功 → 已选点卡片展示 name/address,可点「重新选点」替换
//  3. 点"下一步":跳 post-create,带 selectedKey/categoryLabel/address/lng/lat + communityId
// 坐标为 GCJ-02(微信系),与后端 createPost 入参契约一致,原样提交不回填 VO 的 BD-09 坐标
Page({
  data: {
    categories: [] as JobCategoryGridItem[],
    selectedKey: '' as string,
    categoryLabel: '' as string,
    customCategory: '' as string,
    location: null as ChosenLocationState | null,
    // 圈子：发岗归属圈子（类别宫格与工作地点之间；默认商家当前圈子，可改）；P2-75 发布后全圈同步，选圈仅定归属
    communities: [] as CommunityVo[],
    communityNames: [] as string[], // picker 展示名（与 communities 按下标对齐）
    isCircleAdmin: false as boolean, // 保留字段：P2-75 后选圈不再有免费/付费标注，恒 false
    selectedCommunityId: '' as string,
    selectedCommunityName: '' as string,
    selectedCommunityIndex: 0 as number,
    communityLoadFailed: false as boolean, // 圈子列表加载失败：字段仍展示，点击重试
    canSubmit: false,
  },

  onLoad() {
    this.loadCategories();
    this.loadCommunities();
  },

  // 加载圈子供发岗选择：默认当前圈子（app.globalData.activeCommunityId），否则第一个
  // 加载失败不阻断发岗（post-create 服务端兜底商家当前圈子），但字段仍展示、可点击重试
  async loadCommunities() {
    try {
      const list = await listCommunities();
      if (list.length === 0) {
        this.setData({ communities: [], communityNames: [], communityLoadFailed: true });
        return;
      }
      const app = getApp<AppInstance>();
      const activeId = app.globalData.activeCommunityId;
      // P2-75 圈子仅作归属锚点（原顺序原名，无免费/付费标注），发布后全圈同步
      const picker = buildJobCommunityPicker(list);
      const prefer = picker.list.find((c) => c.id === activeId) ?? picker.list[0]!;
      const idx = picker.list.findIndex((c) => c.id === prefer.id);
      this.setData({
        communities: picker.list,
        communityNames: picker.names,
        isCircleAdmin: picker.isCircleAdmin,
        selectedCommunityId: prefer.id,
        selectedCommunityName: prefer.name,
        selectedCommunityIndex: idx >= 0 ? idx : 0,
        communityLoadFailed: false,
      });
    } catch {
      this.setData({ communityNames: [], communityLoadFailed: true });
    }
  },

  onPickCommunity(e: WechatMiniprogram.TouchEvent) {
    // 列表为空（加载失败）：点击重试，不静默失效
    if (this.data.communities.length === 0) {
      this.loadCommunities();
      return;
    }
    const idx = Number(e.detail.value || 0);
    const c = this.data.communities[idx];
    if (c) this.setData({ selectedCommunityId: c.id, selectedCommunityName: c.name, selectedCommunityIndex: idx });
  },

  // 圈子列表为空（加载失败）时，picker 的 bindchange 大概率不触发，用行 tap 兜底触发重载
  onTapCircleField() {
    if (this.data.communities.length === 0) this.loadCommunities();
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
    const item = this.data.categories.find((c) => c.key === key);
    const isCustom = key === 'CUSTOM';
    this.setData({
      selectedKey: key,
      categoryLabel: isCustom ? this.data.customCategory.trim() : item?.label ?? '',
      customCategory: isCustom ? this.data.customCategory : '',
    });
    this.refreshCanSubmit();
  },

  onCustomCategoryInput(e: WechatMiniprogram.Input) {
    const customCategory = e.detail.value;
    this.setData({ customCategory, categoryLabel: customCategory.trim() });
    this.refreshCanSubmit();
  },

  // 地图选点(wx.chooseLocation 自带地图/搜索/定位;取消/失败静默保持原状态)
  async onChooseLocation() {
    const loc = await chooseLocation();
    if (!loc) return;
    this.setData({ location: loc });
    this.refreshCanSubmit();
  },

  refreshCanSubmit() {
    const hasCategory =
      !!this.data.selectedKey &&
      (this.data.selectedKey !== 'CUSTOM' || !!this.data.customCategory.trim());
    const ok = hasCategory && !!this.data.location?.name;
    this.setData({ canSubmit: ok });
  },

  onNext() {
    if (!this.data.canSubmit || !this.data.location) return;
    const { selectedKey, categoryLabel, customCategory, location } = this.data;
    // 地址文本 = 选点名称 + 详细地址(与圈子创建同口径)
    const address = `${location.name} ${location.address}`.trim();
    let q =
      `selectedKey=${encodeURIComponent(selectedKey)}` +
      `&categoryLabel=${encodeURIComponent(categoryLabel)}` +
      `&customCategory=${encodeURIComponent(selectedKey === 'CUSTOM' ? customCategory.trim() : '')}` +
      `&address=${encodeURIComponent(address)}` +
      `&lng=${location.lng}&lat=${location.lat}`;
    // 发布圈子：把 publish 页所选圈子传给 post-create，让它预选同一圈子（未选/加载失败则不传，post-create 回落当前圈子）
    if (this.data.selectedCommunityId) {
      q += `&communityId=${encodeURIComponent(this.data.selectedCommunityId)}`;
    }
    wx.navigateTo({ url: `/pages/job/post-create/index?${q}` });
  },
});
