import type { AppInstance } from '../../../app';
import { listAnonGroups, listMyAnonGroups, type AnonGroupVo } from '../../../services/treehole';
import { requireAnonymousContentVisibility } from '../../../utils/anonymous-content';

type SortTab = 'recommend' | 'latest' | 'hot';

Page({
  data: {
    groups: [] as AnonGroupVo[],
    myGroups: [] as AnonGroupVo[],
    activeSort: 'recommend' as SortTab,
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    if (!await requireAnonymousContentVisibility()) return;
    if (this.data.groups.length === 0) await this.load();
    await this.loadMy();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const groups = await listAnonGroups(this.data.activeSort);
      this.setData({ groups });
    } catch {
      /* toast */
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  async loadMy() {
    try {
      const myGroups = await listMyAnonGroups();
      this.setData({ myGroups });
    } catch {
      /* ignore */
    }
  },

  onPullDownRefresh() {
    this.load();
    this.loadMy();
  },

  switchSort(e: WechatMiniprogram.TouchEvent) {
    const sort = (e.currentTarget.dataset.sort as SortTab) ?? 'recommend';
    if (sort === this.data.activeSort) return;
    this.setData({ activeSort: sort, groups: [] });
    this.load();
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/treehole/group-create/index' });
  },

  goGroup(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    if (id) wx.navigateTo({ url: `/pages/treehole/group-detail/index?id=${id}` });
  },

  goMyGroups() {
    wx.navigateTo({ url: '/pages/treehole/my-groups/index' });
  },
});
