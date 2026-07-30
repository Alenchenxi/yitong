import type { AppInstance } from '../../../app';
import {
  getMerchantDashboard,
  listJobPosts,
  takeDownJobPost,
  type JobPostVo,
  type MerchantDashboardVo,
} from '../../../services/job';
import { getMerchantProfile } from '../../../services/merchant';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待发布',
  PUBLISHED: '已发布',
  TAKEN_DOWN: '已下架',
  EXPIRED: '已过期',
};

// M3-03 状态筛选 chips（与后端 JobPostStatus 对齐）
const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待发布' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'TAKEN_DOWN', label: '已下架' },
  { value: 'EXPIRED', label: '已过期' },
] as const;

// M3-01 数据看板时间范围 tab
const RANGE_FILTERS = [
  { value: 'day', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
] as const;

type RangeValue = (typeof RANGE_FILTERS)[number]['value'];

// 商家端底部 tab：候选人 / 职位 / 发布 / 消息 / 我的
const MERCHANT_TABS = [
  { path: '/pages/candidates/index', label: '候选人' },
  { path: '/pages/job/manage/index', label: '职位' },
  { path: '/pages/job/post/index', label: '发布' },
  { path: '/pages/notifications/index', label: '消息' },
  { path: '/pages/merchant/profile/index', label: '我的' },
];

interface PostItem extends JobPostVo {
  statusText: string;
  pendingCount: number;
}

Page({
  data: {
    tabs: MERCHANT_TABS,
    current: 'pages/job/manage/index',
    statusFilters: STATUS_FILTERS,
    rangeFilters: RANGE_FILTERS,
    activeStatus: '' as string,
    activeRange: 'all' as RangeValue,
    keyword: '' as string,
    posts: [] as PostItem[],
    dashboard: null as MerchantDashboardVo | null,
    loading: false,
    settled: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    getMerchantProfile()
      .then(() => {
        this.setData({ settled: true });
        this.load();
      })
      .catch(() => {
        wx.redirectTo({ url: '/pages/merchant/register/index' });
      });
  },

  onShow() {
    if (this.data.settled) this.load();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const { activeStatus, keyword, activeRange } = this.data;
      const [postsResp, dashboard] = await Promise.all([
        listJobPosts({
          mine: true,
          status: (activeStatus || undefined) as JobPostVo['status'] | undefined,
          keyword: keyword.trim() || undefined,
        }).catch(() => ({ list: [] as JobPostVo[], hasMore: false, nextCursor: null })),
        getMerchantDashboard(activeRange).catch(() => null),
      ]);
      const posts: PostItem[] = postsResp.list.map((p) => ({
        ...p,
        statusText: STATUS_TEXT[p.status] ?? p.status,
        pendingCount: p.pendingApplicationCount ?? 0,
      }));
      this.setData({ posts, dashboard });
    } finally {
      this.setData({ loading: false });
    }
  },

  // M3-03 状态筛选切换
  onStatusTap(e: WechatMiniprogram.TouchEvent) {
    const value = (e.currentTarget.dataset.value as string) ?? '';
    if (value === this.data.activeStatus) return;
    this.setData({ activeStatus: value });
    this.load();
  },

  // M3-01 看板时间范围切换
  onRangeTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as RangeValue;
    if (value === this.data.activeRange) return;
    this.setData({ activeRange: value });
    this.load();
  },

  // M3-02 搜索
  onKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value });
  },
  onSearch() {
    this.load();
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },

  goPay(e: WechatMiniprogram.TouchEvent) {
    const { id, dur } = e.currentTarget.dataset as { id: string; dur: string };
    wx.navigateTo({ url: `/pages/payment/index?jobPostId=${id}&duration=${dur}` });
  },

  goPost() {
    wx.navigateTo({ url: '/pages/job/post/index' });
  },

  // M3-04 跳编辑岗位
  goEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/post/index?id=${id}` });
  },

  // M3-05 主动下架岗位
  onTakeDown(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const title = e.currentTarget.dataset.title as string;
    wx.showModal({
      title: '下架岗位',
      content: `确定下架「${title}」吗？下架后学生将无法看到此岗位`,
      confirmText: '下架',
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '下架中' });
        try {
          await takeDownJobPost(id);
          wx.showToast({ title: '已下架', icon: 'success' });
          this.load();
        } catch {
          wx.showToast({ title: '下架失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  // M3-06 待处理报名数 badge 跳转（带预筛选）
  goCandidates(e: WechatMiniprogram.TouchEvent) {
    const jobPostId = e.currentTarget.dataset.id as string;
    wx.switchTab({ url: `/pages/candidates/index?jobPostId=${jobPostId}` });
  },
});