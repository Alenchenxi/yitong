import type { AppInstance } from '../../app';
import { listJobPosts } from '../../services/job';
import {
  batchMarkCandidates,
  listMerchantCandidates,
  listMerchantViewers,
  markCandidateContacted,
  markCandidateFit,
  type MerchantCandidateVo,
  type MerchantViewerVo,
} from '../../services/merchant';

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

// M2-05 合适度筛选
const FIT_FILTERS = [
  { value: '', label: '全部' },
  { value: 'FIT', label: '合适' },
  { value: 'UNFIT', label: '不合适' },
] as const;

const STATUS_LABELS: Record<MerchantCandidateVo['status'], string> = {
  PENDING: '待处理',
  ACCEPTED: '已录用',
  DONE: '已完成',
  REJECTED: '未录用',
  CANCELLED: '已取消',
};

// M2-03 顶部 tab：已报名 / 看过我
type SubTab = 'applied' | 'viewed';

interface CandidateItem extends MerchantCandidateVo {
  statusLabel: string;
  createdAtText: string;
  resumeSummary: string;
  contacted: boolean;
  fitLabel: string;
  selected: boolean;
}

interface ViewerItem extends MerchantViewerVo {
  viewedAtText: string;
}

Page({
  data: {
    tabs: MERCHANT_TABS,
    current: 'pages/candidates/index',
    subTab: 'applied' as SubTab,
    statusFilters: STATUS_FILTERS,
    fitFilters: FIT_FILTERS,
    activeStatus: '',
    activeFit: '',
    // 岗位筛选（picker）
    postOptions: ['全部岗位'] as string[],
    postIds: [''] as string[],
    postIndex: 0,
    keyword: '',
    list: [] as CandidateItem[],
    viewerList: [] as ViewerItem[],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loaded: false,
    // 批量模式
    batchMode: false,
    selectedIds: [] as string[],
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
        const res = await listJobPosts(cursor ? { mine: true, cursor } : { mine: true });
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
    this.setData({ page: 1, list: [], viewerList: [], loaded: false, selectedIds: [] });
    await this.loadList(1);
  },

  async loadMore() {
    const { loading, loaded, total, page, subTab } = this.data;
    const count = subTab === 'viewed' ? this.data.viewerList.length : this.data.list.length;
    if (loading || !loaded || count >= total) return;
    await this.loadList(page + 1);
  },

  async loadList(page: number) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const { activeStatus, activeFit, postIds, postIndex, keyword, pageSize, subTab } = this.data;
      if (subTab === 'viewed') {
        const res = await listMerchantViewers({
          jobPostId: postIds[postIndex] || undefined,
          page,
          pageSize,
        });
        const items: ViewerItem[] = res.list.map((v) => ({ ...v, viewedAtText: formatTime(v.viewedAt) }));
        // 看过我列表复用 list 渲染会有差异，单独存 viewerList
        this.setData({
          viewerList: page === 1 ? items : [...(this.data.viewerList ?? []), ...items],
          total: res.total,
          page: res.page,
          loaded: true,
        });
        return;
      }
      const res = await listMerchantCandidates({
        jobPostId: postIds[postIndex] || undefined,
        status: (activeStatus || undefined) as MerchantCandidateVo['status'] | undefined,
        fitMark: (activeFit || undefined) as 'FIT' | 'UNFIT' | undefined,
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
      contacted: !!a.contactedAt,
      fitLabel: a.fitMark === 'FIT' ? '合适' : a.fitMark === 'UNFIT' ? '不合适' : '',
      selected: false,
    };
  },

  // 顶部子 tab 切换：已报名 / 看过我
  onSubTabTap(e: WechatMiniprogram.TouchEvent) {
    const subTab = e.currentTarget.dataset.tab as SubTab;
    if (subTab === this.data.subTab) return;
    this.setData({ subTab, activeStatus: '', activeFit: '', keyword: '', batchMode: false, selectedIds: [] });
    this.refresh();
  },

  onStatusTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    if (value === this.data.activeStatus) return;
    this.setData({ activeStatus: value });
    this.refresh();
  },

  onFitFilterTap(e: WechatMiniprogram.TouchEvent) {
    const value = e.currentTarget.dataset.value as string;
    if (value === this.data.activeFit) return;
    this.setData({ activeFit: value });
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
    // 批量模式下点卡片=选中/取消
    if (this.data.batchMode) {
      this.toggleSelect(e);
      return;
    }
    // 非批量：跳候选人详情（M2-07）
    const { id } = e.currentTarget.dataset as { id: string; jobPostId?: string };
    if (!id) return;
    wx.navigateTo({ url: `/pages/candidates/detail/index?id=${id}` });
  },

  // M2-04 标记/取消 已联系
  async onContactTap(e: WechatMiniprogram.TouchEvent) {
    const { id, idx } = e.currentTarget.dataset as { id: string; idx: number };
    const item = this.data.list[idx];
    if (!item) return;
    const next = !item.contacted;
    try {
      const r = await markCandidateContacted(id, next);
      this.patchItem(idx, { contacted: next, contactedAt: r.contactedAt });
      wx.showToast({ title: next ? '已标记联系' : '已取消联系', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
    }
  },

  // M2-05 标记合适/不合适（循环：未标记->合适->不合适->清除）
  async onFitMarkTap(e: WechatMiniprogram.TouchEvent) {
    const { id, idx } = e.currentTarget.dataset as { id: string; idx: number };
    const item = this.data.list[idx];
    if (!item) return;
    const next: 'FIT' | 'UNFIT' | null =
      item.fitMark === null ? 'FIT' : item.fitMark === 'FIT' ? 'UNFIT' : null;
    try {
      const r = await markCandidateFit(id, next);
      this.patchItem(idx, {
        fitMark: r.fitMark,
        fitLabel: r.fitMark === 'FIT' ? '合适' : r.fitMark === 'UNFIT' ? '不合适' : '',
      });
      wx.showToast({ title: next ? (next === 'FIT' ? '已标记合适' : '已标记不合适') : '已清除标记', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '操作失败', icon: 'none' });
    }
  },

  patchItem(idx: number, patch: Partial<CandidateItem>) {
    const list = this.data.list.slice();
    const cur = list[idx];
    if (!cur) return;
    list[idx] = { ...cur, ...patch };
    this.setData({ list });
  },

  // ---- 批量模式 ----
  onBatchToggle() {
    const batchMode = !this.data.batchMode;
    this.setData({
      batchMode,
      selectedIds: [],
      list: this.data.list.map((it) => ({ ...it, selected: false })),
    });
  },

  toggleSelect(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset as { id: string };
    const selectedIds = this.data.selectedIds.slice();
    const idx = selectedIds.indexOf(id);
    if (idx >= 0) selectedIds.splice(idx, 1);
    else selectedIds.push(id);
    const list = this.data.list.map((it) => ({ ...it, selected: selectedIds.includes(it.id) }));
    this.setData({ selectedIds, list });
  },

  selectAll() {
    const all = this.data.list.map((it) => it.id);
    const selectedIds = this.data.selectedIds.length === all.length ? [] : all;
    const list = this.data.list.map((it) => ({ ...it, selected: selectedIds.includes(it.id) }));
    this.setData({ selectedIds, list });
  },

  async batchAction(e: WechatMiniprogram.TouchEvent) {
    const action = e.currentTarget.dataset.action as 'contact' | 'fit-fit' | 'fit-unfit';
    const { selectedIds } = this.data;
    if (selectedIds.length === 0) {
      wx.showToast({ title: '请先选择候选人', icon: 'none' });
      return;
    }
    const payload =
      action === 'contact'
        ? { ids: selectedIds, mark: 'contacted' as const, contacted: true }
        : action === 'fit-fit'
          ? { ids: selectedIds, mark: 'fit' as const, fitMark: 'FIT' as const }
          : { ids: selectedIds, mark: 'fit' as const, fitMark: 'UNFIT' as const };
    try {
      const res = await batchMarkCandidates(payload);
      const failed = res.processed.filter((p) => !p.ok);
      wx.showToast({
        title:
          failed.length === 0
            ? `已处理 ${res.processed.length} 条`
            : `成功 ${res.processed.length - failed.length} 失败 ${failed.length}`,
        icon: 'none',
      });
      this.setData({ batchMode: false });
      this.refresh();
    } catch (e) {
      wx.showToast({ title: e instanceof Error ? e.message : '批量操作失败', icon: 'none' });
    }
  },
});

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
