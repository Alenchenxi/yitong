import type { AppInstance } from '../../../app';
import {
  listMyCommunities,
  listCommunities,
  switchCommunity,
  joinCommunity,
  type CommunityVo,
} from '../../../services/community';

// 圈子列表：我的圈子 + 全部圈子，加入/切换，入口进创建
Page({
  data: {
    activeId: '',
    myCommunities: [] as CommunityVo[],
    allCommunities: [] as CommunityVo[],
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.refresh();
  },

  async refresh() {
    this.setData({ loading: true });
    try {
      const [mine, all] = await Promise.all([listMyCommunities(), listCommunities()]);
      this.setData({ activeId: mine.activeId ?? '', myCommunities: mine.list, allCommunities: all });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/community/create/index' });
  },

  onSwitch(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const name = e.currentTarget.dataset.name as string;
    if (!id) return;
    switchCommunity(id)
      .then(() => {
        const app = getApp<AppInstance>();
        app.globalData.activeCommunityId = id;
        wx.showToast({ title: `已切换到「${name}」`, icon: 'none' });
        this.refresh();
      })
      .catch(() => {});
  },

  onJoin(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (!id) return;
    joinCommunity(id)
      .then(() => {
        const app = getApp<AppInstance>();
        app.globalData.activeCommunityId = id;
        wx.showToast({ title: '已加入并切换', icon: 'success' });
        this.refresh();
      })
      .catch(() => {});
  },
});
