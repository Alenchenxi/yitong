import type { AppInstance } from '../../app';
import {
  listJobPosts,
  recommendJobs,
  recordJobImpressions,
  SETTLEMENT_LABELS,
  type JobPostVo,
  type Settlement,
} from '../../services/job';
import { getLocationContext } from '../../services/place-suggest';

type Tab = 'recommend' | 'latest' | 'urgent' | 'nearest';
type FilterSection = 'district' | 'settlement';

Page({
  data: {
    tab: 'recommend' as Tab,
    posts: [] as JobPostVo[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    isMerchant: false,
    userLng: 0,
    userLat: 0,
    hasLocation: false,
    filterVisible: false,
    filterSection: 'district' as FilterSection,
    currentCity: '',
    districtOptions: [] as Array<{ label: string; value: string }>,
    settlementOptions: (Object.keys(SETTLEMENT_LABELS) as Settlement[]).map((value) => ({
      value,
      label: SETTLEMENT_LABELS[value],
    })),
    appliedDistrict: '',
    appliedSettlement: '' as Settlement | '',
    draftDistrict: '',
    draftSettlement: '' as Settlement | '',
    filterCount: 0,
    locationLoading: false,
    locationError: '',
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
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
    this.setData({ posts: [], nextCursor: null, hasMore: true });
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
        city: this.data.appliedDistrict ? this.data.currentCity || undefined : undefined,
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
        city: this.data.appliedDistrict ? this.data.currentCity || undefined : undefined,
        settlement: this.data.appliedSettlement || undefined,
      });
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
      this.reportImpressions(resp.list);
    } catch {
      /* request 层统一提示 */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  openFilter() {
    this.setData({
      filterVisible: true,
      draftDistrict: this.data.appliedDistrict,
      draftSettlement: this.data.appliedSettlement,
      locationError: '',
    });
    if (this.data.districtOptions.length === 0 && !this.data.locationLoading) {
      this.loadLocationContext();
    }
  },

  closeFilter() {
    this.setData({
      filterVisible: false,
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

  selectDistrict(e: WechatMiniprogram.TouchEvent) {
    this.setData({ draftDistrict: (e.currentTarget.dataset.value as string) ?? '' });
  },

  selectSettlement(e: WechatMiniprogram.TouchEvent) {
    this.setData({ draftSettlement: (e.currentTarget.dataset.value as Settlement | '') ?? '' });
  },

  resetFilter() {
    this.setData({ draftDistrict: '', draftSettlement: '' });
  },

  applyFilter() {
    const appliedDistrict = this.data.draftDistrict;
    const appliedSettlement = this.data.draftSettlement;
    const filterCount = Number(Boolean(appliedDistrict)) + Number(Boolean(appliedSettlement));
    this.setData({
      appliedDistrict,
      appliedSettlement,
      filterCount,
      filterVisible: false,
    });
    this.reload();
  },

  loadLocationContext() {
    this.setData({ locationLoading: true, locationError: '' });
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: async (res) => {
        this.setData({ userLng: res.longitude, userLat: res.latitude, hasLocation: true });
        try {
          const context = await getLocationContext(res.longitude, res.latitude);
          this.setData({
            currentCity: context.city,
            districtOptions: context.districts.map((district) => ({ label: district, value: district })),
          });
        } catch {
          this.setData({ locationError: '区域加载失败，请稍后重试' });
        } finally {
          this.setData({ locationLoading: false });
        }
      },
      fail: () => {
        this.setData({ locationLoading: false, locationError: '开启位置权限后可选择工作区域' });
      },
    });
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