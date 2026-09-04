import type { AppInstance } from '../../../app';
import {
  ensureJobConversation,
  isJobListCursorExpired,
  listJobPosts,
} from '../../../services/job';
import {
  batchMarkCandidates,
  listMerchantCandidates,
  listMerchantViewers,
  markCandidateContacted,
  markCandidateFit,
  type MerchantCandidateVo,
  type MerchantViewerVo,
} from '../../../services/merchant';

// M2-02 报名状态筛选（与后端 AppStatus 对齐）
const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待处理' },
  { value: 'INTERVIEW_ACCEPTED', label: '待面试' },
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
  acceptedInterviewText: string;
}

interface ViewerItem extends MerchantViewerVo {
  viewedAtText: string;
}

// 商家候选人 panel（迁移自 pages/candidates/index，Page -> Component）
Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    params: {
      type: Object,
      value: {},
      observer(n) {
        this.onParams((n || {}) as Record<string, unknown>);
      },
    },
  },

  data: {
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
    // M3-06 来自 jobs panel 跳转的预筛选 jobPostId
    incomingJobPostId: '' as string,
  },

  methods: {
    // shell 注入 params（如 jobs panel goCandidates 带 jobPostId）；带 _ts nonce 保证同值重触发
    onParams(params: Record<string, unknown>) {
      const jobPostId = params?.jobPostId as string | undefined;
      if (jobPostId) {
        this.setData({ incomingJobPostId: jobPostId });
        this.refresh();
      }
    },

    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      this.loadPosts();
      this.refresh();
    },

    onPanelReachBottom() {
      this.loadMore();
    },

    onPanelPullDown() {
      this.refresh().finally(() => wx.stopPullDownRefresh());
    },

    // 商家自己的岗位（供岗位筛选 picker；最多翻 5 页，够用）
    async loadPosts() {
      try {
        const names: string[] = ['全部岗位'];
        const ids: string[] = [''];
        let cursor: string | undefined;
        let cursorResetAttempted = false;
        let page = 0;
        while (page < 5) {
          let res: Awaited<ReturnType<typeof listJobPosts>>;
          try {
            res = await listJobPosts(cursor ? { mine: true, cursor } : { mine: true });
          } catch (error) {
            if (cursor && !cursorResetAttempted && isJobListCursorExpired(error)) {
              cursorResetAttempted = true;
              cursor = undefined;
              page = 0;
              names.splice(1);
              ids.splice(1);
              continue;
            }
            throw error;
          }
          res.list.forEach((p) => {
            names.push(p.title);
            ids.push(p.id);
          });
          if (!res.hasMore || !res.nextCursor) break;
          cursor = res.nextCursor;
          page += 1;
        }
        // M3-06: 如果来自 jobs panel 带 incomingJobPostId，定位到对应 picker index
        const target = this.data.incomingJobPostId;
        let postIndex = 0;
        if (target) {
          const idx = ids.indexOf(target);
          if (idx >= 0) postIndex = idx;
        }
        this.setData({ postOptions: names, postIds: ids, postIndex });
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
        const { activeStatus, activeFit, postIds, postIndex, keyword, pageSize, subTab, incomingJobPostId } = this.data;
        // M3-06：来自 jobs panel 的预筛选 jobPostId 优先级高于 picker（首次进入 panel 时 loadPosts 异步还未回，
        // 此处仍需用 incomingJobPostId 正确筛选；用完即清，让手动 picker 切换生效）
        const effectiveJobPostId = incomingJobPostId || (postIds[postIndex] || undefined);
        if (incomingJobPostId && page === 1) {
          this.setData({ incomingJobPostId: '' });
        }
        if (subTab === 'viewed') {
          const res = await listMerchantViewers({
            jobPostId: effectiveJobPostId || undefined,
            page,
            pageSize,
          });
          const items: ViewerItem[] = res.list.map((v) => ({ ...v, viewedAtText: formatTime(v.viewedAt) }));
          this.setData({
            viewerList: page === 1 ? items : [...(this.data.viewerList ?? []), ...items],
            total: res.total,
            page: res.page,
            loaded: true,
          });
          return;
        }
        const res = await listMerchantCandidates({
          jobPostId: effectiveJobPostId || undefined,
          status: activeStatus === 'INTERVIEW_ACCEPTED'
            ? undefined
            : (activeStatus || undefined) as MerchantCandidateVo['status'] | undefined,
          interviewStatus: activeStatus === 'INTERVIEW_ACCEPTED' ? 'ACCEPTED' : undefined,
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
        acceptedInterviewText: a.acceptedInterview
          ? `${a.acceptedInterview.meetingDate} ${a.acceptedInterview.meetingTime} · ${a.acceptedInterview.title}`
          : '',
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
      // 手动切换 picker 清掉 M3-06 预筛选，让 picker 真正生效
      this.setData({ postIndex, incomingJobPostId: '' });
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
      // 非批量：跳候选人详情（M2-07）二级页
      const { id } = e.currentTarget.dataset as { id: string; jobPostId?: string };
      if (!id) return;
      wx.navigateTo({ url: `/pages/candidates/detail/index?id=${id}` });
    },

    onDetailTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      if (id) wx.navigateTo({ url: `/pages/candidates/detail/index?id=${id}&section=basic` });
    },

    onResumeTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      if (id) wx.navigateTo({ url: `/pages/candidates/detail/index?id=${id}&section=resume` });
    },

    async onChatTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      if (!id) return;
      try {
        wx.showLoading({ title: '进入沟通', mask: true });
        const conversation = await ensureJobConversation(id);
        wx.hideLoading();
        wx.navigateTo({ url: `/pages/job/chat/index?applicationId=${id}&conversationId=${conversation.id}` });
      } catch {
        wx.hideLoading();
      }
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
  },
});

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
