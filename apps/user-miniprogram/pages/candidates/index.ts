import type { AppInstance } from '../../app';
import { listJobPosts } from '../../services/job';
import { listMerchantCandidates, type MerchantCandidateVo } from '../../services/merchant';

// 商家端底部 tab：候选人 / 职位 / 发布 / 消息 / 我的
const MERCHANT_TABS = [
  { path: '/pages/candidates/index', label: '候选人' },
  { path: '/pages/job/manage/index', label: '职位' },
  { path: '/pages/job/post/index', label: '发布' },
  { path: '/pages/notifications/index', label: '消息' },
  { path: '/pages/merchant/profile/index', label: '我的' },
];

// M2-02 报名状态筛选（与后端 AppStatus 对齐）
const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待处理' },
  { value: 'ACCEPTED', label: '已录用' },
  { value: 'DONE', label: '已完成' },
  { value: 'REJECTED', label: '未录用' },
  { value: 'CANCELLED', label: '已取消' },
] as const;

const STATUS_LABELS: Record<MerchantCandidateVo['status'], string> = {
  PENDING: '待处理',
  ACCEPTED: '已录用',
  DONE: '已完成',
  REJECTED: '未录用',
  CANCELLED: '已取消',
};

interface CandidateItem extends MerchantCandidateVo {
  statusLabel: string;
  createdAtText: string;
  resumeSummary: string;
}

Page({
  data: {
    tabs: MERCHANT_TABS,
    current: 'pages/candidates/index',
    statusFilters: STATUS_FILTERS,
    activeStatus: '',
    // 岗位筛选（picker）
    postOptions: ['全部岗位'] as string[],
    postIds: [''] as string[],
    postIndex: 0,
    keyword: '',
    list: [] as CandidateItem[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loaded: false,
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.loadPosts();
    this.refresh();
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  // 商家自己的岗位（供岗位筛选 picker；最多翻 5 页，够用）
  async loadPosts() {
    try {
      const names: string[] = ['全部岗位'];
      const ids: string[] = [''];
      let cursor: string | undefined;
      for (let i = 0; i < 5; i += 1) {
        const res: Awaited<ReturnType<typeof listJobPosts>> = await listJobPosts(
          cursor ? { mine: true, cursor } : { mine: true },
        );
        res.list.forEach((p) => {
          names.push(p.title);
          ids.push(p.id);
        });
        if (!res.hasMore || !res.nextCursor) break;
        cursor = res.nextCursor;
      }
      this.setData({ postOptions: names, postIds: ids });
    } catch {
      // 岗位筛选加载失败不阻塞候选人列表
    }
  },

  async refresh() {
    this.setData({ page: 1, list: [], loaded: false });
    await this.loadList(1);
  },

  async loadMore() {
    const { loading, list, total, page } = this.data;
    if (loading || !this.data.loaded || list.length >= total) return;
    await this.loadList(page + 1);
  },

  async loadList(page: number) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const { activeStatus, postIds, postIndex, keyword, pageSize } = this.data;
      const res = await listMerchantCandidates({
        jobPostId: postIds[postIndex] || undefined,
        status: (activeStatus || undefined) as MerchantCandidateVo['status'] | undefined,
        keyword: keyword.trim() || undefined,
        page,
        pageSize,
      });
      const items = res.list.map((a) => this.toItem(a));
      this.setData({
        list: page === 1 ? items : [...this.data.list, ...items],
        total: res.total,
        page: res.page,
        loaded: true,
      });
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' });
      this.setData({ loaded: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  toItem(a: MerchantCandidateVo): CandidateItem {
    const resumeSummary = a.resume
      ? [a.resume.name, ...(a.resume.skills ?? [])].filter(Boolean).join(' · ') || '已附简历'
      : '未附简历';
    return {
      ...a,
      statusLabel: STATUS_LABELS[a.status] ?? a.status,
      createdAtText: formatTime(a.createdAt),
      resumeSummary,
    };
  },

  onStatusTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    if (value === this.data.activeStatus) return;
    this.setData({ activeStatus: value });
    this.refresh();
  },

  onPostChange(e: WechatMiniprogram.PickerChange) {
    const postIndex = Number(e.detail.value);
    if (postIndex === this.data.postIndex) return;
    this.setData({ postIndex });
    this.refresh();
  },

  onKeywordInput(e: WechatMiniprogram.Input) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.refresh();
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const { jobPostId } = e.currentTarget.dataset as { jobPostId?: string };
    if (!jobPostId) return;
    wx.navigateTo({ url: `/pages/job/detail/index?id=${jobPostId}` });
  },
});

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
