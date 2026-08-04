// 管理 shell「看板」panel（迁移自 pages/admin/dashboard/index，Page -> Component）
// onPanelShow 拉取看板统计 + 待办计数；待办快捷入口改 switchtab 事件冒泡 shell
import type { AppInstance } from '../../../app';
import {
  getStats,
  getQueue,
  listReports,
  listTickets,
  type DashboardStats,
} from '../../../services/admin';

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
    stats: null as DashboardStats | null,
    pendingMerchants: 0,
    pendingReports: 0,
    pendingTickets: 0,
    loading: false,
  },

  methods: {
    /** shell 注入参数（带 _ts nonce）；看板无 param 驱动初始化，空实现守接口 */
    onParams(_params: Record<string, unknown>) {
      // no-op：看板不消费 shell params
    },

    /** 等价原 onShow：requireAuth + 加载看板统计 */
    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      void this.load();
    },

    // shell 全局开了 enablePullDownRefresh，看板下拉刷新统计（stopPullDownRefresh 由 shell 兜底）
    onPanelPullDown() {
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

    // 待办快捷跳转 -> 通知 shell 切 tab（旧 reLaunch 独立页已废弃）
    // E2 深链：带 params 预选 sub-tab，避免落默认 tab 还要再点一次
    goReview() {
      this.triggerEvent('switchtab', { tab: 'review' });
    },
    goReports() {
      this.triggerEvent('switchtab', { tab: 'review', params: { sub: 'reports' } });
    },
    goTickets() {
      this.triggerEvent('switchtab', { tab: 'users', params: { sub: 'tickets' } });
    },
  },
});
