// P2-26 我的圈子页：3 tab（已加入 / 待审核 / 未通过）
// - 已加入：可点切换
// - 待审核：审核中状态，仅显示（不可切换/不可发帖）
// - 未通过：显示拒绝原因，可点底部"重新提交"按钮
// 入参 ?tab=joined|pending|rejected 可直链目标 tab
import type { AppInstance } from '../../../app';
import {
  listMyCommunitiesAll,
  resubmitCommunity,
  switchCommunity,
  type CommunityVo,
} from '../../../services/community';

type Tab = 'joined' | 'pending' | 'rejected';

Page({
  data: {
    tab: 'joined' as Tab,
    joined: [] as CommunityVo[],
    pending: [] as CommunityVo[],
    rejected: [] as CommunityVo[],
    loading: false,
    resubmittingId: '' as string,
  },

  onLoad(query: Record<string, string>) {
    const t = query?.tab as Tab | undefined;
    if (t === 'joined' || t === 'pending' || t === 'rejected') {
      this.setData({ tab: t });
    }
  },

  onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    this.refresh();
  },

  async refresh() {
    this.setData({ loading: true });
    try {
      const r = await listMyCommunitiesAll();
      this.setData({
        joined: r.joined,
        pending: r.pending,
        rejected: r.rejected,
      });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(e: WechatMiniprogram.TouchEvent) {
    const t = e.currentTarget.dataset.t as Tab;
    if (t === this.data.tab) return;
    this.setData({ tab: t });
  },

  // 已加入：点切换
  onSwitch(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const name = e.currentTarget.dataset.name as string;
    if (!id) return;
    switchCommunity(id)
      .then(() => {
        const app = getApp<AppInstance>();
        app.globalData.activeCommunityId = id;
        app.globalData.joinGate = false;
        wx.showToast({ title: `已切换到「${name}」`, icon: 'none' });
      })
      .catch(() => {});
  },

  // 未通过：重新提交
  onResubmit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const name = e.currentTarget.dataset.name as string;
    if (!id || this.data.resubmittingId) return;
    wx.showModal({
      title: '重新提交',
      content: `确定重新提交「${name}」的审核？`,
      success: async (r) => {
        if (!r.confirm) return;
        this.setData({ resubmittingId: id });
        try {
          await resubmitCommunity(id);
          wx.showToast({ title: '已重新提交，等待审核', icon: 'none', duration: 1500 });
          // 留在 mine 页，refresh() 会把行移到 pending 桶
          await this.refresh();
          this.setData({ tab: 'pending' });
        } catch {
          /* toast */
        } finally {
          this.setData({ resubmittingId: '' });
        }
      },
    });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/community/create/index' });
  },

  goPlaza() {
    wx.switchTab({ url: '/pages/community/plaza/index' });
  },
});
