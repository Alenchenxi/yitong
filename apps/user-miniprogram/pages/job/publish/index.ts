import { getJobCategories, type JobCategoryGridItem } from '../../../services/job';
import { suggestPlaces, type PoiInfoVo } from '../../../services/place-suggest';

// 岗位发布同页入口(2026-08-11):类别网格 + 搜索选点 同页
// 交互:
//  1. onLoad 调 wx.getLocation 定位 → 调百度 reverse  → 反查 poiId/lng/lat/city → 锁定为初始"我的位置"
//  2. 搜索框 input:防抖 300ms 调 suggestPlaces → 候选列表实时展示
//  3. 点击候选:锁定 poiId/lng/lat/city → 列表收起 → 搜索框显示选中地址
//  4. 点"下一步":跳到 post-create,带 7 字段 (selectedKey/categoryLabel/address/poiId/lng/lat/city)
// 注:不显示地图组件,纯搜索框 + 候选列表(按王晨曦 2026-08-11 原方案)
Page({
  data: {
    categories: [] as JobCategoryGridItem[],
    selectedKey: '' as string,
    categoryLabel: '' as string,
    location: {
      address: '',
      poiId: '',
      lng: 0,
      lat: 0,
      city: '',
    },
    // 搜索框状态
    searchInput: '',
    searchFocus: false,
    locating: true, // 初次定位中
    locationFailed: false,
    locationErrMsg: '' as string,
    candidates: [] as PoiInfoVo[],
    searching: false,
    selectedLocked: false, // 已锁定候选,搜索框不再触发搜索
    canSubmit: false,
  },

  onLoad() {
    this.loadCategories();
    this.startLocate();
  },

  async loadCategories() {
    try {
      const data = await getJobCategories();
      this.setData({ categories: data.items });
    } catch {
      wx.showToast({ title: '类别加载失败', icon: 'none' });
    }
  },

  // 初次定位:wx.getLocation → 没有 poiId,只用做占位文本
  // 真实"锁定"由用户输入搜索 → 点击候选完成
  startLocate() {
    this.setData({ locating: true, locationFailed: false, locationErrMsg: '' });
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: (res) => {
        // 拿到坐标后,前端先把坐标存到位置占位(地址写"定位中...")
        // poiId 必须由候选搜索后的点击锁定,这里不锁定
        this.setData({
          location: {
            address: '正在获取地址...',
            poiId: '',
            lng: res.longitude,
            lat: res.latitude,
            city: '',
          },
        });
        // 调百度 reverse 反查地址(detail in location.service)
        // 服务端目前的 getPoiDetail 需要 poiId,reverse 需要 address
        // 简化:不阻塞,直接用坐标 + 调 wx.getLocation 自带的 reverse 接口(微信自带)
        // 这里给出简单的 city 推断:根据 lat/lng 范围简单判定
        const city = this.guessCity(res.latitude, res.longitude);
        this.setData({
          location: {
            address: `当前定位(${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)})`,
            poiId: '',
            lng: res.longitude,
            lat: res.latitude,
            city,
          },
          locating: false,
          locationFailed: false,
        });
      },
      fail: (err) => {
        console.error('wx.getFuzzyLocation failed:', err?.errMsg);
        this.setData({
          locating: false,
          locationFailed: true,
          locationErrMsg: err?.errMsg || '未知错误',
        });
        wx.showToast({ title: '定位失败，请手动输入', icon: 'none' });
      },
    });
  },

  // 粗粒度城市推断(防止下次搜索 region 失败),不保证准确
  guessCity(lat: number, lng: number): string {
    if (lat > 39 && lat < 41 && lng > 116 && lng < 117) return '北京';
    if (lat > 31 && lat < 32 && lng > 121 && lng < 122) return '上海';
    if (lat > 22 && lat < 24 && lng > 113 && lng < 114) return '广州';
    if (lat > 22 && lat < 23 && lng > 113 && lng < 115) return '深圳';
    return '北京';
  },

  onPickCategory(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    const item = this.data.categories.find((c) => c.key === key);
    this.setData({ selectedKey: key, categoryLabel: item?.label ?? '' });
    this.refreshCanSubmit();
  },

  // 搜索框输入
  onSearchInput(e: WechatMiniprogram.Input) {
    const v = e.detail.value;
    this.setData({ searchInput: v, selectedLocked: false });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    if (!v.trim()) {
      this.setData({ candidates: [] });
      return;
    }
    this._searchTimer = setTimeout(() => this.doSearch(v.trim()), 300) as unknown as number;
  },

  // 搜索框聚焦:清空候选(用户期望重新输入)
  onSearchFocus() {
    this.setData({ searchFocus: true, selectedLocked: false, candidates: [] });
  },

  // 搜索框失焦
  onSearchBlur() {
    this.setData({ searchFocus: false });
  },

  async doSearch(q: string) {
    this.setData({ searching: true });
    try {
      const list = await suggestPlaces(q, this.data.location.city || undefined);
      this.setData({ candidates: list, searching: false });
    } catch (e) {
      console.error('place-suggestion failed:', e);
      this.setData({ searching: false, candidates: [] });
      // 不弹"搜索失败"覆盖 request.ts 已弹的后端真实 message(如"百度地图候选搜索失败:xxx")
    }
  },

  // 点击候选:锁定 poiId/lng/lat/city
  onPickCandidate(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx);
    const c = this.data.candidates[idx];
    if (!c) return;
    this.setData({
      location: {
        address: c.address,
        poiId: c.poiId,
        lng: c.lng,
        lat: c.lat,
        city: c.city,
      },
      searchInput: c.address,
      candidates: [],
      selectedLocked: true,
    });
    this.refreshCanSubmit();
  },

  // 重新定位
  onRelocate() {
    this.startLocate();
  },

  refreshCanSubmit() {
    const ok = !!this.data.selectedKey && !!this.data.location.poiId;
    this.setData({ canSubmit: ok });
  },

  onNext() {
    if (!this.data.canSubmit) return;
    const { selectedKey, categoryLabel, location } = this.data;
    const q =
      `selectedKey=${encodeURIComponent(selectedKey)}` +
      `&categoryLabel=${encodeURIComponent(categoryLabel)}` +
      `&address=${encodeURIComponent(location.address)}` +
      `&poiId=${encodeURIComponent(location.poiId)}` +
      `&lng=${location.lng}&lat=${location.lat}` +
      `&city=${encodeURIComponent(location.city)}`;
    wx.navigateTo({ url: `/pages/job/post-create/index?${q}` });
  },

  _searchTimer: 0 as number,
});
