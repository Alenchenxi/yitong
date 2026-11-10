import { myActivities, setInterest, type ActivityListVo } from '../../../services/activity';

const TABS: Array<{ key: string; label: string }> = [
  { key: 'enrolled', label: '已报名' },
  { key: 'pending', label: '待审核' },
  { key: 'waitlist', label: '候补' },
  { key: 'interested', label: '感兴趣' },
  { key: 'ended', label: '已结束' },
  { key: 'cancelled', label: '已取消' },
  { key: 'not_interested', label: '不感兴趣' },
];

const STATUS_TEXT: Record<string, string> = {
  PUBLISHED: '报名中',
  UPCOMING: '待开始',
  ONGOING: '进行中',
  ENDED: '已结束',
  CANCELLED: '已取消',
  DELISTED: '已下架',
};

Page({
  data: {
    tabs: TABS,
    activeTab: 'enrolled',
    list: [] as Array<ActivityListVo & { statusText: string }>,
    loading: false,
  },

  onShow() {
    void this.reload();
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
      const res = await myActivities(this.data.activeTab);
      this.setData({
        list: res.list.map((a) => ({ ...a, statusText: STATUS_TEXT[a.status] ?? a.status })),
      });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  openDetail(e: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/activity/detail/index?id=${e.currentTarget.dataset.id}` });
  },

  async restore(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    try {
      await setInterest(id, ''); // 恢复：清除不感兴趣，活动重新进入上新弹窗
      wx.showToast({ title: '已恢复', icon: 'success' });
      await this.reload();
    } catch {
      /* toast 已在 request 内 */
    }
  },
});
