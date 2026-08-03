import type { AppInstance } from '../../../app';
import {
  getStats,
  getQueue,
  listReports,
  listTickets,
  type DashboardStats,
} from '../../../services/admin';

// 管理端底部 tab：看板 / 审核 / 运营 / 用户 / 我的
const ADMIN_TABS = [
  { path: '/pages/admin/dashboard/index', label: '看板' },
  { path: '/pages/admin/review/index', label: '审核' },
  { path: '/pages/admin/ops/index', label: '运营' },
  { path: '/pages/admin/users/index', label: '用户' },
  { path: '/pages/admin/profile/index', label: '我的' },
];

Page({
  data: {
    tabs: ADMIN_TABS,
    current: 'pages/admin/dashboard/index',
    stats: null as DashboardStats | null,
    pendingMerchants: 0,
    pendingReports: 0,
    pendingTickets: 0,
    loading: false,
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const [stats, queue, reportsRes, tickets] = await Promise.all([
        getStats(),
        getQueue(),
        listReports('PENDING', 1, 1),
        listTickets('OPEN'),
      ]);
      this.setData({
        stats,
        pendingMerchants: queue.merchants.filter((m) => m.status === 'PENDING').length,
        pendingReports: reportsRes.total,
        pendingTickets: tickets.length,
      });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  // 待办快捷跳转
  goReview() {
    wx.reLaunch({ url: '/pages/admin/review/index' });
  },
  goUsers() {
    wx.reLaunch({ url: '/pages/admin/users/index' });
  },
});
