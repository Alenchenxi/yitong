import { listActivities, type ActivityListVo } from '../../services/activity';

const STATUS_TABS: Array<{ key: string; label: string; value?: string }> = [
  { key: 'open', label: '可报名' },
  { key: 'upcoming', label: '待开始', value: 'UPCOMING' },
  { key: 'ongoing', label: '进行中', value: 'ONGOING' },
  { key: 'ended', label: '已结束', value: 'ENDED' },
];

const STATUS_TEXT: Record<string, string> = {
  PUBLISHED: '报名中',
  UPCOMING: '待开始',
  ONGOING: '进行中',
  ENDED: '已结束',
  CANCELLED: '已取消',
  DELISTED: '已下架',
};

const FORMAT_TEXT: Record<string, string> = {
  OFFLINE: '线下',
  ONLINE: '线上',
  HYBRID: '线上+线下',
};

Page({
  data: {
    navTop: 0,
    navHeight: 44,
    tabs: STATUS_TABS,
    activeTab: 'open',
    list: [] as Array<ActivityListVo & { statusText: string; formatText: string; timeText: string }>,
    loading: false,
  },

  onLoad() {
    const win = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    this.setData({
      navTop: menu.top,
      navHeight: menu.height,
    });
    void win;
  },

  async onShow() {
    await this.reload();
    // 冷启动上新弹窗（组件自带冷启动门闩，前后台切换不重复）
    const arrivals = this.selectComponent('#activityArrivals') as unknown as { maybeShow: () => void } | null;
    arrivals?.maybeShow?.();
  },

  async onPullDownRefresh() {
    await this.reload();
    wx.stopPullDownRefresh();
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key as string;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    void this.reload();
  },

  async reload() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const tab = STATUS_TABS.find((t) => t.key === this.data.activeTab);
      // 可报名 = 报名中；其余按状态过滤
      const status = tab?.value ?? 'PUBLISHED';
      const res = await listActivities(status);
      this.setData({
        list: res.list.map((a) => ({
          ...a,
          statusText: STATUS_TEXT[a.status] ?? a.status,
          formatText: FORMAT_TEXT[a.format] ?? a.format,
          timeText: formatRange(a.startTime, a.endTime),
        })),
      });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  openDetail(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/activity/detail/index?id=${id}` });
  },

  goMine() {
    wx.navigateTo({ url: '/pages/activity/my/index' });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/activity/publish/index' });
  },
});

function formatRange(start: string | null, end: string | null): string {
  if (!start) return '长期活动';
  const s = new Date(start);
  const pad = (n: number) => `${n}`.padStart(2, '0');
  const base = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())} ${pad(s.getHours())}:${pad(s.getMinutes())}`;
  if (!end) return base;
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const endTime = sameDay
    ? `${pad(e.getHours())}:${pad(e.getMinutes())}`
    : `${e.getFullYear()}-${pad(e.getMonth() + 1)}-${pad(e.getDate())} ${pad(e.getHours())}:${pad(e.getMinutes())}`;
  return `${base} ~ ${endTime}`;
}
