import type { AppInstance } from '../../../app';
import { listMyAnonGroups, type AnonGroupVo } from '../../../services/treehole';
import { requireAnonymousContentVisibility } from '../../../utils/anonymous-content';

Page({
  data: {
    groups: [] as AnonGroupVo[],
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const groups = await listMyAnonGroups();
      this.setData({ groups });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  onPullDownRefresh() {
    this.load();
  },

  goGroup(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/treehole/group-detail/index?id=${id}` });
  },
});
