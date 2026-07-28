import type { AppInstance } from '../../../app';
import { listJobPosts, getMerchantDashboard, type JobPostVo, type MerchantDashboardVo } from '../../../services/job';
import { getMerchantProfile } from '../../../services/merchant';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待发布',
  PUBLISHED: '已发布',
  TAKEN_DOWN: '已下架',
  EXPIRED: '已过期',
};

// 商家端底部 tab：候选人 / 职位 / 发布 / 消息 / 我的
const MERCHANT_TABS = [
  { path: '/pages/candidates/index', label: '候选人' },
  { path: '/pages/job/manage/index', label: '职位' },
  { path: '/pages/job/post/index', label: '发布' },
  { path: '/pages/notifications/index', label: '消息' },
  { path: '/pages/merchant/profile/index', label: '我的' },
];

Page({
  data: {
    posts: [] as Array<JobPostVo & { statusText: string }>,
    dashboard: null as MerchantDashboardVo | null,
    loading: false,
    settled: false, // 入驻探测完成（已入驻 true / 未入驻将跳走）
    tabs: MERCHANT_TABS,
    current: 'pages/job/manage/index',
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 商家首页：未入驻直接跳入驻页（getMerchantProfile 未入驻抛 60002）
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

  async load() {
    this.setData({ loading: true });
    try {
      const [postsResp, dashboard] = await Promise.all([
        listJobPosts({ mine: true }).catch(() => ({ list: [] as JobPostVo[] })),
        getMerchantDashboard('all').catch(() => null),
      ]);
      this.setData({
        posts: postsResp.list.map((p) => ({ ...p, statusText: STATUS_TEXT[p.status] ?? p.status })),
        dashboard,
      });
    } finally {
      this.setData({ loading: false });
    }
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
});