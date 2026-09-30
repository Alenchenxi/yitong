import type { AppInstance } from '../../../app';
import {
  listCommunities,
  switchCommunity,
  joinCommunity,
  type CommunityVo,
} from '../../../services/community';

// 圈子广场：左侧类型列表（全部 + 校园/兴趣/生活/兼职）+ 右侧该类型圈子列表
// 成员圈子点击 → 切换 + 回广场；非成员圈子 → 卡片内「加入」按钮
const CATEGORIES = ['全部', '校园', '兴趣', '生活', '兼职'];

Page({
  data: {
    categories: CATEGORIES,
    activeCategory: '全部',
    circles: [] as CommunityVo[],
    loading: false,
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const cat = this.data.activeCategory === '全部' ? undefined : this.data.activeCategory;
      const circles = await listCommunities(cat);
      this.setData({ circles });
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  switchCategory(e: WechatMiniprogram.TouchEvent) {
    const cat = e.currentTarget.dataset.cat as string;
    if (cat === this.data.activeCategory) return;
    this.setData({ activeCategory: cat, circles: [] });
    this.load();
  },

  // 成员圈子卡片：切换 → 回广场
  onTapCircle(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const name = e.currentTarget.dataset.name as string;
    if (!id) return;
    switchCommunity(id)
      .then(() => {
        const app = getApp<AppInstance>();
        app.globalData.activeCommunityId = id;
        app.globalData.joinGate = false;
        wx.showToast({ title: `已切换到「${name}」`, icon: 'none' });
        wx.switchTab({ url: '/pages/square/index' });
      })
      .catch(() => {});
  },

  // 非成员圈子：加入 + 置为当前 → 回广场
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
