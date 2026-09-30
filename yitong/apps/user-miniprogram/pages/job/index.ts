import type { AppInstance } from '../../app';
import {
  listJobPosts,
  isJobListCursorExpired,
  recommendJobs,
  recordJobImpressions,
  getLocationFacets,
  SETTLEMENT_LABELS,
  type JobPostVo,
  type Settlement,
} from '../../services/job';
import { syncCustomTabBar } from '../../utils/custom-tabbar';
import { bindJobModulePageGuard, requireJobModuleVisibility } from '../../utils/job-module';

type Tab = 'recommend' | 'latest' | 'urgent' | 'nearest';
type FilterSection = 'district' | 'settlement';

Page({
  data: {
    tab: 'recommend' as Tab,
    posts: [] as JobPostVo[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    cursorResetAttempted: false,
    isMerchant: false,
    userLng: 0,
    userLat: 0,
    hasLocation: false,
    filterVisible: false,
    filterSection: 'district' as FilterSection,
    // P2-79 去百度地图:区域筛选改「手动选有岗城市」——facets 聚合有岗城市 + 选中城市的区县列表(不再自动定位)
    cityOptions: [] as Array<{ city: string; count: number }>,
    districtOptions: [] as Array<{ label: string; value: string }>,
    settlementOptions: (Object.keys(SETTLEMENT_LABELS) as Settlement[]).map((value) => ({
      value,
      label: SETTLEMENT_LABELS[value],
    })),
    appliedCity: '',
    appliedDistrict: '',
    appliedSettlement: '' as Settlement | '',
    draftCity: '',
    draftDistrict: '',
    draftSettlement: '' as Settlement | '',
    filterCount: 0,
    facetsLoading: false,
    facetsError: '',
    districtsLoading: false,
  },

  onLoad() {
    // 兼职板块平台开关：关闭时 user 角色退出本页（商家发岗不受影响）
    bindJobModulePageGuard(this);
  },

  async onShow() {
    syncCustomTabBar(this, '/pages/job/index');
    if (!(await requireJobModuleVisibility())) return;
    const app = getApp<AppInstance>();
    const isMerchant = app.globalData.currentRole === 'MERCHANT';
    this.setData({ isMerchant, tab: isMerchant ? 'latest' : 'recommend' });
    this.reload();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const t = (e.currentTarget.dataset.tab as Tab) ?? 'recommend';
    if (t === this.data.tab) return;
    this.setData({ tab: t });
    if (t === 'nearest' && !this.data.hasLocation) {
      this.getLocationAndLoad();
    } else {
      this.reload();
    }
  },

  getLocationAndLoad() {
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ userLng: res.longitude, userLat: res.latitude, hasLocation: true });
        this.reload();
      },
      fail: () => {
        wx.showToast({ title: '需要位置权限查看附近岗位', icon: 'none' });
        this.setData({ tab: 'recommend', hasLocation: false });
      },
    });
  },

  async reload() {
    this.setData({
      posts: [],
      nextCursor: null,
      hasMore: true,
      cursorResetAttempted: false,
    });
    if (this.data.tab === 'recommend') {
      await this.loadRecommend();
    } else {
      await this.loadMore();
    }
  },

  async loadRecommend() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const list = await recommendJobs({
        location: this.data.appliedDistrict || undefined,
        city: this.data.appliedCity || undefined,
        settlement: this.data.appliedSettlement || undefined,
      });
      this.setData({ posts: list, hasMore: false, nextCursor: null });
      this.reportImpressions(list);
    } catch {
      /* request 层统一提示 */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    let resetExpiredCursor = false;
    try {
      const isUrgent = this.data.tab === 'urgent';
      const isNearest = this.data.tab === 'nearest';
      const resp = await listJobPosts({
        cursor: this.data.nextCursor ?? undefined,
        urgent: isUrgent || undefined,
        sort: isNearest ? 'nearest' : undefined,
        userLng: isNearest ? this.data.userLng : undefined,
        userLat: isNearest ? this.data.userLat : undefined,
        location: this.data.appliedDistrict || undefined,
        city: this.data.appliedCity || undefined,
        settlement: this.data.appliedSettlement || undefined,
      });
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
      this.reportImpressions(resp.list);
    } catch (error) {
      if (
        this.data.nextCursor
        && !this.data.cursorResetAttempted
        && isJobListCursorExpired(error)
      ) {
        resetExpiredCursor = true;
        this.setData({
          posts: [],
          nextCursor: null,
          hasMore: true,
          cursorResetAttempted: true,
        });
      }
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
    if (resetExpiredCursor) await this.loadMore();
  },

  openFilter() {
    this.setData({
      filterVisible: true,
      draftCity: this.data.appliedCity,
      draftDistrict: this.data.appliedDistrict,
      draftSettlement: this.data.appliedSettlement,
      facetsError: '',
    });
    // 城市列表只拉一次;重进面板若为空(上次失败)则重试
    if (this.data.cityOptions.length === 0 && !this.data.facetsLoading) {
      this.loadCityFacets();
    }
  },

  closeFilter() {
    this.setData({
      filterVisible: false,
      draftCity: this.data.appliedCity,
      draftDistrict: this.data.appliedDistrict,
      draftSettlement: this.data.appliedSettlement,
    });
  },

  noop() {},

  switchFilterSection(e: WechatMiniprogram.TouchEvent) {
    const section = e.currentTarget.dataset.section as FilterSection;
    if (section === 'district' || section === 'settlement') {
      this.setData({ filterSection: section });
    }
  },

  // P2-79:有岗城市聚合(facets),不依赖定位
  async loadCityFacets() {
    this.setData({ facetsLoading: true, facetsError: '' });
    try {
      const facets = await getLocationFacets();
      this.setData({ cityOptions: facets.cities });
    } catch {
      this.setData({ facetsError: '城市列表加载失败，请稍后重试' });
    } finally {
      this.setData({ facetsLoading: false });
    }
  },

  // 选城市:换城市清区县草稿(区县属旧城市),并拉该市区县列表(本地数据包全量,含无岗区县)
  async selectCity(e: WechatMiniprogram.TouchEvent) {
    const city = (e.currentTarget.dataset.value as string) ?? '';
    this.setData({ draftCity: city, draftDistrict: '', districtOptions: [] });
    if (!city) return;
    this.setData({ districtsLoading: true });
    try {
      const facets = await getLocationFacets(city);
      this.setData({
        districtOptions: (facets.districts ?? []).map((district) => ({ label: district, value: district })),
      });
    } catch {
      /* 区县加载失败仅影响区县细分,城市筛选仍可用;request 层已提示 */
    } finally {
      this.setData({ districtsLoading: false });
    }
  },

  selectDistrict(e: WechatMiniprogram.TouchEvent) {
    this.setData({ draftDistrict: (e.currentTarget.dataset.value as string) ?? '' });
  },

  selectSettlement(e: WechatMiniprogram.TouchEvent) {
    this.setData({ draftSettlement: (e.currentTarget.dataset.value as Settlement | '') ?? '' });
  },

  resetFilter() {
    this.setData({ draftCity: '', draftDistrict: '', draftSettlement: '' });
  },

  applyFilter() {
    const appliedCity = this.data.draftCity;
    const appliedDistrict = this.data.draftDistrict;
    const appliedSettlement = this.data.draftSettlement;
    const filterCount =
      Number(Boolean(appliedCity)) +
      Number(Boolean(appliedDistrict)) +
      Number(Boolean(appliedSettlement));
    this.setData({
      appliedCity,
      appliedDistrict,
      appliedSettlement,
      filterCount,
      filterVisible: false,
    });
    this.reload();
  },

  onPullDownRefresh() {
    this.reload();
  },

  onReachBottom() {
    if (this.data.tab !== 'recommend') this.loadMore();
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/job/search/index' });
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },

  goPost() {
    wx.navigateTo({ url: '/pages/job/publish/index' });
  },

  reportImpressions(posts: JobPostVo[]) {
    const ids = posts.map((p) => p.id).filter(Boolean);
    if (!ids.length) return;
    recordJobImpressions(ids).catch(() => {});
  },

  goManage() {
    wx.navigateTo({ url: '/pages/merchant/index?tab=jobs' });
  },

  goMyApps() {
    wx.navigateTo({ url: '/pages/job/my-applications/index' });
  },
});
