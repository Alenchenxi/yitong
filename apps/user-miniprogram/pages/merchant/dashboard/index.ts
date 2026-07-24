import type { AppInstance } from '../../../app';
import {
  getMerchantDashboard,
  type DashboardRange,
  type MerchantDashboardVo,
} from '../../../services/job';

const RANGE_TABS: Array<{ key: DashboardRange; label: string }> = [
  { key: 'day', label: '今日' },
  { key: 'week', label: '近 7 天' },
  { key: 'month', label: '近 30 天' },
  { key: 'all', label: '全部' },
];

Page({
  data: {
    range: 'all' as DashboardRange,
    tabs: RANGE_TABS,
    data: null as MerchantDashboardVo | null,
    loading: false,
  },

  onLoad() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const d = await getMerchantDashboard(this.data.range);
      this.setData({ data: d });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
    }
  },

  switchRange(e: WechatMiniprogram.TouchEvent) {
    const r = e.currentTarget.dataset.range as DashboardRange;
    if (r === this.data.range) return;
    this.setData({ range: r });
    this.load();
  },
});