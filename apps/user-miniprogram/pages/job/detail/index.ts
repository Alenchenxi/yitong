import type { AppInstance } from '../../../app';
import {
  getJobPost,
  applyJob,
  listPostReviews,
  listPostApplications,
  transitionApp,
  JOB_CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  type JobPostVo,
  type JobReviewVo,
  type JobAppVo,
} from '../../../services/job';
import { checkFavorite, toggleFavorite } from '../../../services/favorite';
import { requestJobApplySubscribe, requestJobStatusSubscribe } from '../../../services/subscribe-message';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待处理',
  ACCEPTED: '已录用',
  DONE: '已完成',
  CANCELLED: '已取消',
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
    apps: [] as Array<JobAppVo & { statusText: string }>,
    isMerchantOwner: false,
    applying: false,
    transitioning: '',
    subscribingApply: false,
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
          categoryLabel: post.category ? JOB_CATEGORY_LABELS[post.category] : '',
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
          this.setData({
            isMerchantOwner: true,
            apps: apps.map((a) => ({ ...a, statusText: STATUS_TEXT[a.status] ?? a.status })),
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
    if (this.data.applying) return;
    this.setData({ applying: true });
    try {
      await requestJobStatusSubscribe();
      await applyJob(this.postId);
      wx.showToast({ title: '报名成功', icon: 'success' });
    } catch {
      /* 40002 重复报名 toast 已弹 */
    } finally {
      this.setData({ applying: false });
    }
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
    const { id, action } = e.currentTarget.dataset as { id: string; action: 'accept' | 'complete' };
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
});
