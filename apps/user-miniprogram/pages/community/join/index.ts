import type { AppInstance } from '../../../app';
import { listCommunities, joinCommunity, type CommunityVo } from '../../../services/community';

// 加入圈子页：未加入圈子的用户进广场时引导进入；点圈子直接加入并置为当前；顶部可创建圈子
Page({
  data: {
    circles: [] as CommunityVo[],
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (this.data.circles.length === 0) this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const circles = await listCommunities();
      this.setData({ circles });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/community/create/index' });
  },

  // 点击圈子：加入 + 置为当前 → 回广场
  onJoin(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const name = e.currentTarget.dataset.name as string;
    if (!id) return;
    joinCommunity(id)
      .then(() => {
        const app = getApp<AppInstance>();
        app.globalData.activeCommunityId = id;
        app.globalData.joinGate = false;
        wx.showToast({ title: `已加入「${name}」`, icon: 'success' });
        wx.switchTab({ url: '/pages/square/index' });
      })
      .catch(() => {});
  },
});
