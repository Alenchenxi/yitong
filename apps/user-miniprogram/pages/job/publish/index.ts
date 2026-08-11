import { getJobCategories, type JobCategoryGridItem } from '../../../services/job';
import { suggestPlaces, reverseGeocode, type PoiInfoVo } from '../../../services/place-suggest';

// 岗位发布同页入口(2026-08-11):类别网格 + 搜索选点 同页
// 交互:
//  1. onLoad 调 wx.getFuzzyLocation 定位 → 调百度 reverse → 反查 poiId/lng/lat/city → 自动锁定为默认选点
//  2. 搜索框 input:防抖 300ms 调 suggestPlaces → 候选列表实时展示
//  3. 点击候选:锁定 poiId/lng/lat/city → 列表收起 → 搜索框显示选中地址
//  4. 点"下一步":跳到 post-create,带 7 字段 (selectedKey/categoryLabel/address/poiId/lng/lat/city)
// 注:不显示地图组件,纯搜索框 + 候选列表(按王晨曦 2026-08-11 原方案)
// 反查失败(silent):降级到「当前位置占位」+ 提示「未识别当前位置,请搜索」,不阻断流程
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
    locating: true, // 初次定位中(wx.getFuzzyLocation 进行中)
    locationFailed: false,
    locationErrMsg: '' as string,
    autoLocking: false, // 反向地理编码进行中(wx.getFuzzyLocation 成功 → 调 reverse 中)
    autoLockFailed: false, // 反向地理编码失败(降级提示,允许用户手动搜)
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

  // 初次定位:wx.getFuzzyLocation 拿到 gcj02 坐标 → 调后端 reverse-geocode 自动锁定默认 POI
  // 真实"锁定"由自动反查完成;用户仍可手动搜候选替换(走 onPickCandidate → lockLocation 同一路径)
  // 反查失败(silent):降级到「当前定位(经纬度)」占位,提示「未识别当前位置,请搜索」,不阻断流程
  startLocate() {
    this.setData({
      locating: true,
      locationFailed: false,
      locationErrMsg: '',
      autoLocking: false,
      autoLockFailed: false,
    });
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        // 1. 写入坐标占位(poiId 仍空,address 用占位文本)
        this.setData({
          location: { address: '正在获取地址...', poiId: '', lng: longitude, lat: latitude, city: '' },
        });
        // 2. 粗略推断 city(用于反查失败时搜索 region 兜底;百度 reverse 也会带 city,但 dev mock 不带)
        const city = this.guessCity(latitude, longitude);
        // 3. 定位成功 → 进入自动反查阶段(setData 切到「自动选点中...」hint)
        this.setData({
          location: { address: `当前模糊位置:${city || '未知区域'} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, poiId: '', lng: longitude, lat: latitude, city },
          locating: false,
          locationFailed: false,
          autoLocking: true,
        });
        // 4. 调后端 reverse-geocode 自动选点(失败 silent 静默降级)
        reverseGeocode(longitude, latitude)
          .then((poi) => {
            // 反查成功 → 走 lockLocation 同一锁定路径(自动锁定 + 可手动搜替换)
            this.lockLocation(poi);
          })
          .catch((e) => {
            // 反查失败 → 降级到当前位置占位,不弹 toast(silent: true)
            console.error('reverseGeocode failed:', e?.message ?? e);
            this.setData({
              autoLocking: false,
              autoLockFailed: true,
              // location 保留当前定位占位;poiId 仍空,等用户手动搜
            });
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

  // 锁定候选 POI(自动反查成功 + 用户手动点击候选 共用此路径)
  // 自动锁定后 user 可继续输入搜索 → onSearchFocus 会清掉 selectedLocked + candidates
  lockLocation(poi: PoiInfoVo) {
    this.setData({
      location: {
        address: poi.address,
        poiId: poi.poiId,
        lng: poi.lng,
        lat: poi.lat,
        city: poi.city,
      },
      searchInput: poi.address,
      candidates: [],
      selectedLocked: true,
      autoLocking: false,
      autoLockFailed: false,
    });
    this.refreshCanSubmit();
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

  // 点击候选:锁定 poiId/lng/lat/city(走 lockLocation 同一路径,与自动反查锁定一致)
  onPickCandidate(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.idx);
    const c = this.data.candidates[idx];
    if (!c) return;
    this.lockLocation(c);
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
