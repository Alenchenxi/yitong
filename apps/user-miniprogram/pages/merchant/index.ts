import type { AppInstance } from '../../app';
import { getMerchantProfile } from '../../services/merchant';

// 商家 shell 5 tab：候选人 / 职位 / 发布 / 消息 / 我的，默认落「职位」
const MERCHANT_TABS = [
  { key: 'candidates', label: '候选人', iconPath: '/assets/tabbar/m-candidates.png', selectedIconPath: '/assets/tabbar/m-candidates-active.png' },
  { key: 'jobs', label: '职位', iconPath: '/assets/tabbar/m-jobs.png', selectedIconPath: '/assets/tabbar/m-jobs-active.png' },
  { key: 'post', label: '发布', iconPath: '/assets/tabbar/m-post.png', selectedIconPath: '/assets/tabbar/m-post-active.png' },
  { key: 'notifications', label: '消息', iconPath: '/assets/tabbar/m-notifications.png', selectedIconPath: '/assets/tabbar/m-notifications-active.png' },
  { key: 'profile', label: '我的', iconPath: '/assets/tabbar/m-profile.png', selectedIconPath: '/assets/tabbar/m-profile-active.png' },
] as const;

const TAB_KEYS = ['candidates', 'jobs', 'post', 'notifications', 'profile'] as const;
const DEFAULT_TAB = 'jobs';

interface PanelParams {
  [key: string]: unknown;
  _ts?: number;
}

interface PanelInstance {
  onPanelShow?: () => void;
  onPanelReachBottom?: () => void;
  onPanelPullDown?: () => void | Promise<void>;
  onParams?: (params: PanelParams) => void;
}

Page({
  data: {
    tabs: MERCHANT_TABS,
    activeTab: DEFAULT_TAB,
    loaded: {} as Record<string, boolean>,
    tabParams: {
      candidates: {},
      jobs: {},
      post: {},
      notifications: {},
      profile: {},
    } as Record<string, PanelParams>,
    refreshing: false, // scroll-view 下拉刷新受控态
  },

  onLoad(options: { tab?: string } & Record<string, string>) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    // 入驻探测：未入驻 redirectTo register（getMerchantProfile 成功则放行）
    getMerchantProfile().catch(() => {
      wx.redirectTo({ url: '/pages/merchant/register/index' });
    });
    // 解析 ?tab=（白名单校验，非法落默认）+ 其余 query 注入该 tab params（带 _ts nonce 保证同值重触发）
    const tab =
      options.tab && (TAB_KEYS as readonly string[]).includes(options.tab) ? options.tab : DEFAULT_TAB;
    const params: PanelParams = {};
    Object.keys(options).forEach((k) => {
      if (k !== 'tab') params[k] = options[k];
    });
    this.setData({
      activeTab: tab,
      [`loaded.${tab}`]: true,
      [`tabParams.${tab}`]: { ...params, _ts: Date.now() },
    });
  },

  onShow() {
    wx.hideHomeButton();
    this.notifyPanel();
  },

  onReady() {
    // 首次渲染完成，当前 panel 已 attached，补一次刷新（onShow 时可能尚未 attached）
    this.notifyPanel();
  },

  // scroll-view 触底 -> 当前 panel 加载更多
  onScrollLower() {
    this.callPanel('onPanelReachBottom');
  },

  // scroll-view 下拉刷新 -> 当前 panel 刷新
  async onRefresh() {
    this.setData({ refreshing: true });
    try {
      await Promise.resolve(this.callPanel('onPanelPullDown'));
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /** 通知当前 panel 刷新（shell onShow / onReady / 切 tab 后调用） */
  notifyPanel() {
    const p = this.selectComponent(`#panel-${this.data.activeTab}`) as PanelInstance | null;
    if (p && typeof p.onPanelShow === 'function') p.onPanelShow();
  },

  callPanel(method: 'onPanelReachBottom' | 'onPanelPullDown'): unknown {
    const p = this.selectComponent(`#panel-${this.data.activeTab}`) as PanelInstance | null;
    if (p && typeof p[method] === 'function') return p[method]();
    return undefined;
  },

  onTabChange(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    this.activateTab(e.detail.key);
  },

  /** panel 内 switchtab 事件冒泡：切 tab 可带 params（如 jobs->post 编辑 {tab:'post',params:{id}}） */
  onPanelSwitchTab(e: WechatMiniprogram.CustomEvent<{ tab: string; params?: PanelParams }>) {
    this.activateTab(e.detail.tab, e.detail.params);
  },

  activateTab(key: string, params?: PanelParams) {
    if (!(TAB_KEYS as readonly string[]).includes(key)) return;
    // 发布/编辑岗位走独立页面（带系统返回箭头），不切 panel
    // 2026-08-11:改为发布走新同页入口 /pages/job/publish(类别网格 + 搜索选点)
    if (key === 'post') {
      const id = params?.id as string | undefined;
      if (id) {
        // 编辑模式:走原 post-edit 页(内部改用 publish 流程)
        wx.navigateTo({ url: `/pages/merchant/post-edit/index?id=${id}` });
      } else {
        wx.navigateTo({ url: '/pages/job/publish/index?from=merchant' });
      }
      return;
    }
    const updates: Record<string, unknown> = {
      activeTab: key,
      [`loaded.${key}`]: true,
    };
    if (params) updates[`tabParams.${key}`] = { ...params, _ts: Date.now() };
    this.setData(updates);
    // 等 panel 创建 attached 后通知加载（首次激活该 tab 时 panel 刚 wx:if 创建）
    setTimeout(() => {
      const p = this.selectComponent(`#panel-${key}`) as PanelInstance | null;
      if (!p) return;
      if (params && typeof p.onParams === 'function') p.onParams(params);
      if (typeof p.onPanelShow === 'function') p.onPanelShow();
    }, 0);
  },
});
