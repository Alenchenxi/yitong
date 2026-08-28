import type { AppInstance } from '../../../app';
import {
  listJobPosts,
  isJobListCursorExpired,
  JOB_CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  type JobCategory,
  type Settlement,
  type JobListFilter,
  type JobPostVo,
} from '../../../services/job';

interface CatOpt {
  value: string; // '' 表示全部
  label: string;
  selected: boolean;
}

// P0-18 分类 / 结算方式选项（含「全部」）
const CATEGORY_OPTIONS: CatOpt[] = [
  { value: '', label: '全部', selected: true },
  ...(Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map((value) => ({
    value,
    label: JOB_CATEGORY_LABELS[value],
    selected: false,
  })),
];
const SETTLEMENT_OPTIONS: CatOpt[] = [
  { value: '', label: '全部', selected: true },
  ...(Object.keys(SETTLEMENT_LABELS) as Settlement[]).map((value) => ({
    value,
    label: SETTLEMENT_LABELS[value],
    selected: false,
  })),
];

Page({
  data: {
    keyword: '',
    categoryOptions: CATEGORY_OPTIONS,
    settlementOptions: SETTLEMENT_OPTIONS,
    online: false,
    salaryMin: '',
    salaryMax: '',
    location: '',
    posts: [] as JobPostVo[],
    nextCursor: null as string | null,
    hasMore: true,
    loading: false,
    cursorResetAttempted: false,
    searched: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },

  onKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value });
  },
  onLocationInput(e: WechatMiniprogram.Input) {
    this.setData({ location: e.detail.value });
  },
  onSalaryMinInput(e: WechatMiniprogram.Input) {
    this.setData({ salaryMin: (e.detail.value as string).replace(/[^0-9]/g, '') });
  },
  onSalaryMaxInput(e: WechatMiniprogram.Input) {
    this.setData({ salaryMax: (e.detail.value as string).replace(/[^0-9]/g, '') });
  },
  toggleOnline() {
    this.setData({ online: !this.data.online });
  },
  pickCategory(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    this.setData({
      categoryOptions: this.data.categoryOptions.map((o) => ({ ...o, selected: o.value === value })),
    });
  },
  pickSettlement(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    this.setData({
      settlementOptions: this.data.settlementOptions.map((o) => ({ ...o, selected: o.value === value })),
    });
  },

  // P0-18 组装筛选参数
  buildFilter(cursor?: string): JobListFilter {
    const category = this.data.categoryOptions.find((o) => o.selected && o.value !== '')?.value as
      | JobCategory
      | undefined;
    const settlement = this.data.settlementOptions.find((o) => o.selected && o.value !== '')?.value as
      | Settlement
      | undefined;
    const filter: JobListFilter = { cursor };
    if (this.data.keyword.trim()) filter.keyword = this.data.keyword.trim();
    if (category) filter.category = category;
    if (settlement) filter.settlement = settlement;
    if (this.data.location.trim()) filter.location = this.data.location.trim();
    if (this.data.online) filter.online = true;
    if (this.data.salaryMin) filter.salaryMin = Number(this.data.salaryMin);
    if (this.data.salaryMax) filter.salaryMax = Number(this.data.salaryMax);
    return filter;
  },

  async search() {
    this.setData({
      posts: [],
      nextCursor: null,
      hasMore: true,
      searched: true,
      cursorResetAttempted: false,
    });
    await this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    let resetExpiredCursor = false;
    try {
      const resp = await listJobPosts(this.buildFilter(this.data.nextCursor ?? undefined));
      this.setData({
        posts: [...this.data.posts, ...resp.list],
        nextCursor: resp.nextCursor,
        hasMore: resp.hasMore,
      });
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
    }
    if (resetExpiredCursor) await this.loadMore();
  },

  onReachBottom() {
    if (this.data.searched) this.loadMore();
  },

  goDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
  },
});
