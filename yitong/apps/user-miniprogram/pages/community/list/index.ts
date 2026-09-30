import type { AppInstance } from '../../../app';
import {
  listMyCommunities,
  getCommunity,
  switchCommunity,
  joinCommunity,
  leaveCommunity,
  type CommunityVo,
} from '../../../services/community';

// 圈子切换页：当前圈子头卡 + ···（退出圈子）+ 我的圈子 + 圈子广场/搜索/创建入口
// 支持 onLoad?id= 预览非成员圈子（头卡显示「加入」按钮）
Page({
  data: {
    active: null as CommunityVo | null, // 当前圈子
    activeId: '',
    preview: null as CommunityVo | null, // 非成员预览（onLoad?id=）
    myCommunities: [] as CommunityVo[],
    loading: false,
  },

  onLoad(query: Record<string, string>) {
    const id = query?.id;
    if (id) this.loadPreview(id);
  },

  async onShow() {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    await this.refresh();
  },

  // 非成员预览：头卡展示该圈子 + 「加入」按钮
  async loadPreview(id: string) {
    try {
      const c = await getCommunity(id);
      this.setData({ preview: c });
    } catch {
      /* 圈子不存在/已禁用：保持当前态 */
    }
  },

  async refresh() {
    this.setData({ loading: true });
    try {
      const mine = await listMyCommunities();
      const active = mine.list.find((c) => c.id === mine.activeId) ?? null;
      this.setData({ activeId: mine.activeId ?? '', active, myCommunities: mine.list });
      const app = getApp<AppInstance>();
      if (active) app.globalData.activeCommunityId = active.id;
    } catch {
      /* toast 已在 request 内 */
    } finally {
      this.setData({ loading: false });
    }
  },

  goPlaza() {
    wx.navigateTo({ url: '/pages/community/plaza/index' });
  },

  goSearchCircle() {
    wx.navigateTo({ url: '/pages/community/search/index' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/community/create/index' });
  },

  // 当前圈子右上角 ··· → 底部菜单（仅「退出圈子」）
  onMore() {
    if (!this.data.active) return;
    wx.showActionSheet({
      itemList: ['退出圈子'],
      success: (res) => {
        if (res.tapIndex === 0) this.confirmLeave();
      },
    });
  },

  confirmLeave() {
    const active = this.data.active;
    if (!active) return;
    wx.showModal({
      title: '退出圈子',
      content: `确定退出「${active.name}」吗？`,
      success: (r) => {
        if (!r.confirm) return;
        leaveCommunity(active.id)
          .then(() => {
            const app = getApp<AppInstance>();
            app.globalData.activeCommunityId = '';
            wx.showToast({ title: '已退出', icon: 'success' });
            this.setData({ active: null, activeId: '', preview: null });
            // 回广场：未加入圈子 → 广场 onShow 引导加入页
            wx.switchTab({ url: '/pages/square/index' });
          })
          .catch(() => {});
      },
    });
  },

  // 我的圈子：点击切换当前圈子 → 回广场
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
        wx.switchTab({ url: '/pages/square/index' });
      })
      .catch(() => {});
  },

  // 非成员预览：加入并置为当前 → 回广场
  onJoinPreview() {
    const preview = this.data.preview;
    if (!preview) return;
    this.joinAndGo(preview.id, preview.name);
  },

  joinAndGo(id: string, name: string) {
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
