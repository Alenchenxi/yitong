import type { AppInstance } from '../../../app';
import {
  getJobPost,
  listPostReviews,
  listPostApplications,
  transitionApp,
  batchTransitionApps,
  reportJob,
  reportMerchant,
  reportApplication,
  merchantReviewApp,
  JOB_CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  type JobPostVo,
  type JobReviewVo,
  type JobAppVo,
} from '../../../services/job';
import { checkFavorite, toggleFavorite } from '../../../services/favorite';
import { requestJobApplySubscribe } from '../../../services/subscribe-message';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待处理',
  ACCEPTED: '已录用',
  DONE: '已完成',
  CANCELLED: '已取消',
  REJECTED: '未录用',
};

Page({
  data: {
    post: null as (JobPostVo & {
      favorited?: boolean;
      categoryLabel?: string;
      settlementLabel?: string;
      workDatesText?: string;
      workPeriodsText?: string;
    }) | null,
    reviews: [] as Array<JobReviewVo & { stars: string }>,
    apps: [] as Array<JobAppVo & { statusText: string; selected: boolean }>,
    isMerchantOwner: false,
    applying: false,
    transitioning: '',
    subscribingApply: false,
    batchMode: false,
    batchProcessing: false,
    // P1-26 商家评价学生
    reviewAppId: '',
    reviewRating: 5,
    reviewContent: '',
    reviewSubmitting: false,
    reviewedIds: [] as string[], // 已评过的报名 id 前端隐去按钮
  },
  postId: '',

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
    try {
      const post = await getJobPost(this.postId);
      const reviews = await listPostReviews(this.postId).catch(() => []);
      const favorite = await checkFavorite('job_post', this.postId).catch(() => null);
      this.setData({
        post: {
          ...post,
          favorited: favorite?.favorited ?? false,
          // P0-17 结构化字段展示标签
          categoryLabel: post.customCategory ||
            (post.category ? JOB_CATEGORY_LABELS[post.category] : ''),
          settlementLabel: post.settlement ? SETTLEMENT_LABELS[post.settlement] : '',
          workDatesText: post.workDates.join('、'),
          workPeriodsText: post.workPeriods.join('、'),
        },
        reviews: reviews.map((r) => ({ ...r, stars: '★'.repeat(r.rating) })),
      });
      const app = getApp<AppInstance>();
      if (app.globalData.currentRole === 'MERCHANT') {
        try {
          const apps = await listPostApplications(this.postId);
          // P1-26 由 reviews 反推 reviewedIds，过滤已评过按钮
          const reviewedIds = reviews
            .filter((r) => r.direction === 'merchant_to_stu')
            .map((r) => r.applicationId);
          this.setData({
            isMerchantOwner: true,
            reviewedIds,
            apps: apps.map((a) => ({ ...a, statusText: STATUS_TEXT[a.status] ?? a.status, selected: false })),
          });
        } catch {
          this.setData({ isMerchantOwner: false });
        }
      }
    } catch {
      /* toast */
    }
  },

  async apply() {
    if (this.data.post?.applyMode === 'CONTACT_ONLY') return;
    // P0-21 报名走报名页（带简历 + 报名问题）
    wx.navigateTo({ url: `/pages/job/apply/index?id=${this.postId}` });
  },

  async subscribeJobApply() {
    if (this.data.subscribingApply) return;
    this.setData({ subscribingApply: true });
    try {
      const accepted = await requestJobApplySubscribe();
      wx.showToast({ title: accepted ? '已订阅报名提醒' : '未开启订阅', icon: 'none' });
    } finally {
      this.setData({ subscribingApply: false });
    }
  },

  async transition(e: WechatMiniprogram.TouchEvent) {
    const { id, action } = e.currentTarget.dataset as { id: string; action: 'accept' | 'complete' | 'reject' };
    if (this.data.transitioning) return;
    this.setData({ transitioning: id });
    try {
      await transitionApp(id, action);
      wx.showToast({ title: '已操作', icon: 'success' });
      await this.load();
    } catch {
      /* toast */
    } finally {
      this.setData({ transitioning: '' });
    }
  },

  // P0-23 批量录用/拒绝
  toggleBatchMode() {
    this.setData({
      batchMode: !this.data.batchMode,
      apps: this.data.apps.map((a) => ({ ...a, selected: false })),
    });
  },
  toggleSelect(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    this.setData({
      apps: this.data.apps.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a)),
    });
  },
  selectAll() {
    const allSelected = this.data.apps.filter((a) => a.status === 'PENDING').every((a) => a.selected);
    this.setData({
      apps: this.data.apps.map((a) => (a.status === 'PENDING' ? { ...a, selected: !allSelected } : a)),
    });
  },
  async batchAction(e: WechatMiniprogram.TouchEvent) {
    const action = e.currentTarget.dataset.action as 'accept' | 'reject';
    const ids = this.data.apps.filter((a) => a.selected).map((a) => a.id);
    if (this.data.batchProcessing || ids.length === 0 || !this.postId) return;
    this.setData({ batchProcessing: true });
    try {
      const r = await batchTransitionApps(this.postId, ids, action);
      const ok = r.processed.filter((p) => p.ok).length;
      wx.showToast({ title: `已处理 ${ok} 条`, icon: 'none' });
      this.setData({ batchMode: false });
      await this.load();
    } catch {
      /* toast */
    } finally {
      this.setData({ batchProcessing: false });
    }
  },

  async onFavorite() {
    if (!this.data.post) return;
    try {
      const r = await toggleFavorite({ targetType: 'job_post', targetId: this.data.post.id });
      this.setData({ 'post.favorited': r.favorited });
      wx.showToast({ title: r.favorited ? '已收藏' : '已取消', icon: 'success' });
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // P0-19 分享
  onShareAppMessage() {
    const post = this.data.post;
    return {
      title: post ? `${post.title} · ${post.salary}` : '燚桐兼职',
      path: `/pages/job/detail/index?id=${this.postId}`,
    };
  },

  // ===== P1-26 商家评价学生 =====
  openMerchantReview(e: WechatMiniprogram.TouchEvent) {
    const appId = e.currentTarget.dataset.id as string;
    this.setData({ reviewAppId: appId, reviewRating: 5, reviewContent: '' });
  },
  cancelMerchantReview() {
    this.setData({ reviewAppId: '' });
  },
  pickReviewRating(e: WechatMiniprogram.TouchEvent) {
    this.setData({ reviewRating: Number(e.currentTarget.dataset.r) });
  },
  onMerchantReviewInput(e: WechatMiniprogram.Input) {
    this.setData({ reviewContent: e.detail.value });
  },
  async submitMerchantReview() {
    if (this.data.reviewSubmitting) return;
    const { reviewAppId, reviewRating, reviewContent } = this.data;
    if (!reviewContent.trim()) {
      wx.showToast({ title: '请写评语', icon: 'none' });
      return;
    }
    this.setData({ reviewSubmitting: true });
    try {
      await merchantReviewApp(reviewAppId, { rating: reviewRating, content: reviewContent.trim() });
      wx.showToast({ title: '评价成功', icon: 'success' });
      this.setData({
        reviewAppId: '',
        reviewedIds: [...this.data.reviewedIds, reviewAppId],
      });
      await this.load();
    } catch {
      /* toast */
    } finally {
      this.setData({ reviewSubmitting: false });
    }
  },

  // P0-19 举报岗位
  onReport() {
    if (!this.postId) return;
    wx.showModal({
      title: '举报岗位',
      editable: true,
      placeholderText: '选填：举报原因（如虚假信息/违规）',
      confirmText: '举报',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await reportJob(this.postId, res.content || undefined);
          wx.showToast({ title: '已举报，平台将核实', icon: 'success' });
        } catch {
          /* toast */
        }
      },
    });
  },

  // P1-27 举报商家
  onReportMerchant() {
    const merchantId = this.data.post?.merchantId;
    if (!merchantId) return;
    wx.showModal({
      title: '举报商家',
      editable: true,
      placeholderText: '选填：举报原因（如资质造假/欺诈）',
      confirmText: '举报',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await reportMerchant(merchantId, res.content || undefined);
          wx.showToast({ title: '已举报，平台将核实', icon: 'success' });
        } catch {
          /* toast */
        }
      },
    });
  },

  // P1-27 报名投诉（商家视角：投诉该报名的学生）
  onReportApplication(e: WechatMiniprogram.TouchEvent) {
    const appId = e.currentTarget.dataset.id as string;
    if (!appId) return;
    wx.showModal({
      title: '投诉该报名',
      editable: true,
      placeholderText: '选填：投诉原因（如爽约/信息不实）',
      confirmText: '投诉',
      confirmColor: '#E63946',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await reportApplication(appId, res.content || undefined);
          wx.showToast({ title: '已投诉，平台将核实', icon: 'success' });
        } catch {
          /* toast */
        }
      },
    });
  },
});
