// M3-07 商家端职位详情页：状态徽标 / 标题价格 / 工作信息卡 / 展开段 / 单岗位数据 / 专属客服 / 底部删除 + 开始招聘
// 复用 user detail 页的 data 字段（MerchantDashboard range / JobPostVo / getPostChipLabels），不引入新类型。
import type { AppInstance } from '../../../app';
import {
  getJobPost,
  getJobPostStats,
  deleteJobPost,
  republishJobPost,
  getPostChipLabels,
  type JobPostVo,
  type PostStatsVo,
  type PostChipLabels,
  type DashboardRange,
} from '../../../services/job';

const STATUS_TEXT: Record<JobPostVo['status'], string> = {
  PENDING: '待发布',
  PUBLISHED: '已发布',
  TAKEN_DOWN: '已下架',
  EXPIRED: '已过期',
};

type StatKey = 'exposureCount' | 'applicationCount' | 'conversionRate';

Page({
  data: {
    post: null as JobPostVo | null,
    stats: null as PostStatsVo | null, // null = 加载失败/未到，回退显示 '--'
    activeRange: 'month' as DashboardRange,
    expanded: false,
    deleting: false,
    chips: { first: '兼职', second: '可商议' } as PostChipLabels,
    workDatesText: '',
    workPeriodsText: '',
    createdAtText: '',
    // 数值占位（避免 wxml 0/false/null 全部走隐藏分支）
    statsExposure: '--',
    statsApplication: '--',
    statsConversion: '--',
  },

  postId: '',
  loading: false,

  onLoad(options: { id?: string }) {
    if (!options?.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.postId = options.id;
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.postId) await this.load();
  },

  async load() {
    if (this.loading) return;
    this.loading = true;
    try {
      const post = await getJobPost(this.postId);
      const stats = await getJobPostStats(this.postId, 'month').catch(() => null);
      this.applyPost(post, stats);
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.loading = false;
    }
  },

  // 拆出来便于切换 time range stats 时复用
  applyPost(post: JobPostVo, stats: PostStatsVo | null) {
    const chips = getPostChipLabels(post);
    this.setData({
      post,
      stats,
      chips,
      workDatesText: post.workDates?.join('、') || '',
      workPeriodsText: post.workPeriods?.join('、') || '',
      createdAtText: this.formatDate(post.createdAt),
      statsExposure: stats ? String(stats.exposureCount) : '--',
      statsApplication: stats ? String(stats.applicationCount) : '--',
      statsConversion: stats ? `${stats.conversionRate}%` : '--',
    });
  },

  formatDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  onToggleExpand() {
    this.setData({ expanded: !this.data.expanded });
  },

  // PENDING 直跳支付；PUBLISHED / TAKEN_DOWN / EXPIRED 先 republish 再跳
  async onStartHiring() {
    const post = this.data.post;
    if (!post) return;
    if (post.status === 'PENDING') {
      wx.navigateTo({ url: `/pages/payment/index?jobPostId=${post.id}&duration=${post.duration}` });
      return;
    }
    // PUBLISHED / TAKEN_DOWN / EXPIRED：先 republish 回退 PENDING，再跳支付
    try {
      wx.showLoading({ title: '处理中', mask: true });
      await republishJobPost(post.id);
      wx.hideLoading();
      wx.navigateTo({ url: `/pages/payment/index?jobPostId=${post.id}&duration=${post.duration}` });
    } catch {
      wx.hideLoading();
    }
  },

  // 「删除」按钮：仅 PENDING 草稿；二次确认 -> 服务端软删 -> 返回
  onDelete() {
    const post = this.data.post;
    if (!post || post.status !== 'PENDING') return;
    wx.showModal({
      title: '删除草稿',
      content: `确定删除「${post.title}」吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#F53F3F',
      success: async (res) => {
        if (!res.confirm) return;
        if (this.data.deleting) return;
        this.setData({ deleting: true });
        try {
          wx.showLoading({ title: '删除中', mask: true });
          await deleteJobPost(post.id);
          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 300);
        } catch {
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        } finally {
          this.setData({ deleting: false });
        }
      },
    });
  },

  // 「专属客服」入口：跳 FAQ（决策 ⑥ 选 FAQ，零工作量）
  onSupport() {
    wx.navigateTo({ url: '/pages/help/faq/index' });
  },

  onCallContact() {
    const phone = this.data.post?.contactPhone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone }).catch(() => undefined);
  },

  onCopyWechat() {
    const wechat = this.data.post?.contactWechat;
    if (!wechat) return;
    wx.setClipboardData({ data: wechat });
  },

  // 朋友分享保留（路径带 id）
  onShareAppMessage() {
    const post = this.data.post;
    return {
      title: post ? `${post.title} · ${post.salary}` : '燚桐兼职',
      path: `/pages/merchant/job-detail/index?id=${this.postId}`,
    };
  },

  // 防止 wxml 数据绑定的下划线 prop 解析报错（保留以备时间范围切换功能扩展）
  _noopRange(_e: WechatMiniprogram.TouchEvent, _key: StatKey) {
    /* current UX: range 默认 month 不切；预留接口 */
  },
});
