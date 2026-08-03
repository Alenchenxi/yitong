// 商家 shell 职位 panel（迁移自 pages/job/manage/index，Page -> Component）
import type { AppInstance } from '../../../app';
import {
  getMerchantDashboard,
  listJobPosts,
  takeDownJobPost,
  type JobPostVo,
  type MerchantDashboardVo,
} from '../../../services/job';

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

interface PostItem extends JobPostVo {
  statusText: string;
  pendingCount: number;
}

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
    statusFilters: STATUS_FILTERS,
    rangeFilters: RANGE_FILTERS,
    activeStatus: '' as string,
    activeRange: 'all' as RangeValue,
    keyword: '' as string,
    posts: [] as PostItem[],
    dashboard: null as MerchantDashboardVo | null,
    loading: false,
  },

  methods: {
    // shell 注入 params（带 _ts nonce 保证同值重触发）；jobs panel 原无 query 参数，保留接口供扩展
    onParams(_params: Record<string, unknown>) {
      // 预留：未来可支持 switchtab({tab:'jobs', params:{status}}) 预筛选
    },

    // 等价原 onShow：requireAuth + 加载（入驻探测已上移 shell，panel 不重复）
    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      this.load();
    },

    // 列表为单页加载（limit=20，原页未做 cursor 翻页），预留接口
    onPanelReachBottom() {
      // no-op
    },

    onPanelPullDown() {
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

    // 二级页 navigateTo 保留不改
    goDetail(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      wx.navigateTo({ url: `/pages/job/detail/index?id=${id}` });
    },

    // 二级页 navigateTo 保留不改
    goPay(e: WechatMiniprogram.TouchEvent) {
      const { id, dur } = e.currentTarget.dataset as { id: string; dur: string };
      wx.navigateTo({ url: `/pages/payment/index?jobPostId=${id}&duration=${dur}` });
    },

    // 新建岗位 -> 切发布 tab（事件冒泡 shell）
    goPost() {
      this.triggerEvent('switchtab', { tab: 'post' });
    },

    // M3-04 跳编辑岗位 -> 切发布 tab 并带 id
    goEdit(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      this.triggerEvent('switchtab', { tab: 'post', params: { id } });
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

    // M3-06 待处理报名数 badge 跳转（带预筛选）：candidates 现为 shell 内 tab，switchtab 带 jobPostId
    goCandidates(e: WechatMiniprogram.TouchEvent) {
      const jobPostId = e.currentTarget.dataset.id as string;
      this.triggerEvent('switchtab', { tab: 'candidates', params: { jobPostId } });
    },
  },
});
