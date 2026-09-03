import type { AppInstance } from '../../app';
import type { AdminAccessVo } from '../../services/admin';

// 管理 shell 5 tab：看板 / 审核 / 运营 / 用户 / 我的，默认落「看板」
const ADMIN_TABS = [
  { key: 'dashboard', label: '看板', iconPath: '/assets/tabbar/a-dashboard.png', selectedIconPath: '/assets/tabbar/a-dashboard-active.png' },
  { key: 'review', label: '审核', iconPath: '/assets/tabbar/a-review.png', selectedIconPath: '/assets/tabbar/a-review-active.png' },
  { key: 'ops', label: '运营', iconPath: '/assets/tabbar/a-ops.png', selectedIconPath: '/assets/tabbar/a-ops-active.png' },
  { key: 'users', label: '用户', iconPath: '/assets/tabbar/a-users.png', selectedIconPath: '/assets/tabbar/a-users-active.png' },
  { key: 'profile', label: '我的', iconPath: '/assets/tabbar/a-profile.png', selectedIconPath: '/assets/tabbar/a-profile-active.png' },
] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

const TAB_KEYS = ['dashboard', 'review', 'ops', 'users', 'profile'] as const;
const DEFAULT_TAB = 'dashboard';

function can(access: AdminAccessVo, ...permissions: string[]) {
  return access.isPlatform || permissions.some((permission) => access.permissions.includes(permission));
}

function visibleTabs(access: AdminAccessVo) {
  return ADMIN_TABS.filter((tab) => {
    if (tab.key === 'profile') return true;
    if (tab.key === 'dashboard') return can(access, 'dashboard.view');
    if (tab.key === 'review') {
      return can(access, 'merchant.review', 'content.moderate', 'report.manage');
    }
    if (tab.key === 'ops') {
      return can(
        access,
        'operations.global',
        'community.banner.manage',
        'community.view',
        'community.edit',
        'community.review',
      );
    }
    return can(access, 'user.manage', 'ticket.manage')
      || (access.isPlatform && can(access, 'admin.manage', 'admin_type.manage'));
  });
}

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
    tabs: [] as AdminTab[],
    activeTab: DEFAULT_TAB,
    loaded: {} as Record<string, boolean>,
    tabParams: {} as Record<string, PanelParams>,
    refreshing: false, // scroll-view 下拉刷新受控态
    accessReady: false,
  },

  async onLoad(options: { tab?: string } & Record<string, string>) {
    const app = getApp<AppInstance>();
    if (!app.requireAuth()) return;
    const access = await app.refreshAdminAccess();
    if (!access) {
      wx.showToast({ title: '管理员权限已失效', icon: 'none' });
      app.logout();
      return;
    }
    const tabs = visibleTabs(access);
    // 解析 ?tab=（白名单校验，非法落默认）+ 其余 query 注入该 tab params（带 _ts nonce 保证同值重触发）
    const requested =
      options.tab && (TAB_KEYS as readonly string[]).includes(options.tab) ? options.tab : DEFAULT_TAB;
    const tab = tabs.some((item) => item.key === requested) ? requested : (tabs[0]?.key ?? 'profile');
    const params: PanelParams = {};
    Object.keys(options).forEach((k) => {
      if (k !== 'tab') params[k] = options[k];
    });
    this.setData({
      activeTab: tab,
      tabs,
      accessReady: true,
      [`loaded.${tab}`]: true,
      [`tabParams.${tab}`]: { ...params, _ts: Date.now() },
    });
  },

  onShow() {
    wx.hideHomeButton();
    const app = getApp<AppInstance>();
    void app.refreshAdminAccess().then((access) => {
      if (!access) return;
      const tabs = visibleTabs(access);
      const activeTab = tabs.some((item) => item.key === this.data.activeTab)
        ? this.data.activeTab
        : (tabs[0]?.key ?? 'profile');
      this.setData({
        tabs,
        activeTab,
        ['loaded.' + activeTab]: true,
      }, () => this.notifyPanel());
    });
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

  /** panel 内 switchtab 事件冒泡：切 tab 可带 params */
  onPanelSwitchTab(e: WechatMiniprogram.CustomEvent<{ tab: string; params?: PanelParams }>) {
    this.activateTab(e.detail.tab, e.detail.params);
  },

  activateTab(key: string, params?: PanelParams) {
    if (
      !(TAB_KEYS as readonly string[]).includes(key)
      || !this.data.tabs.some((tab) => tab.key === key)
    ) return;
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
