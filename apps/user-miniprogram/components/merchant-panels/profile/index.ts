// 商家 shell「我的」panel（迁移自 pages/merchant/profile/index，Page -> Component）
// onPanelShow 加载商家资料 + 未读数；同端 tab 跳转改 switchtab 事件冒泡 shell
import type { AppInstance } from '../../../app';
import {
  getMerchantProfile,
  type MerchantVo,
} from '../../../services/merchant';
import { listNotifications } from '../../../services/notification';
import { refreshRoles, ALL_ROLES, roleLabel } from '../../../services/auth';

const STATUS_TEXT: Record<string, string> = {
  PENDING: '审核中',
  APPROVED: '已认证',
  REJECTED: '未通过',
};

Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    params: {
      type: Object,
      value: {},
      observer(n) {
        this.onParams((n || {}) as Record<string, unknown>);
      },
    },
  },

  data: {
    merchant: null as MerchantVo | null,
    statusText: '',
    notMerchant: false,
    editing: false,
    shopName: '',
    contactPhone: '',
    saving: false,
    unreadCount: 0,
    currentRole: '',
    lastRejectReason: null as string | null,
    // role switching
    myRoles: [] as string[],
    switchingRole: '',
  },

  methods: {
    onParams(_params: Record<string, unknown>) {},

    onPanelShow() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      this.setData({ currentRole: app.globalData.currentRole });
      this.load();
      this.loadUnread();
      this.loadRoles();
    },

    async loadRoles() {
      try {
        const roles = await refreshRoles();
        if (roles) this.setData({ myRoles: roles });
      } catch {
        const app = getApp<AppInstance>();
        if (app.globalData.user) this.setData({ myRoles: app.globalData.user.roles });
      }
    },

    async onSwitchRole(e: WechatMiniprogram.TouchEvent) {
      const role = e.currentTarget.dataset.role as string;
      if (!role || role === this.data.currentRole || this.data.switchingRole) return;
      if (!this.data.myRoles.includes(role)) {
        wx.showToast({ title: '暂无该角色权限', icon: 'none' });
        return;
      }
      this.setData({ switchingRole: role });
      try {
        const app = getApp<AppInstance>();
        await app.switchRole(role.toLowerCase() as 'user' | 'merchant' | 'admin');
        app.routeToRoleHome(role.toLowerCase());
      } catch {
        refreshRoles().then((roles) => { if (roles) this.setData({ myRoles: roles }); });
      } finally {
        this.setData({ switchingRole: '' });
      }
    },

    async load() {
      try {
        const m = await getMerchantProfile();
        // lastRejectReason 字段是后端 2026-08-10 扩展，老后端可能缺失
        const lastRejectReason = (m && m.lastRejectReason) ?? null;
        this.setData({
          merchant: m,
          statusText: STATUS_TEXT[m.status] || m.status,
          shopName: m.shopName,
          contactPhone: m.contactPhone,
          notMerchant: false,
          lastRejectReason,
        });
      } catch {
        // shell 已做入驻探测，能进此 panel 说明已入驻；失败仅置空，不再 redirectTo register
        this.setData({ notMerchant: true, merchant: null });
      }
    },

    async loadUnread() {
      try {
        const resp = await listNotifications(false, 1);
        this.setData({ unreadCount: resp.unreadCount });
      } catch {
        this.setData({ unreadCount: 0 });
      }
    },

    toggleEdit() {
      if (!this.data.merchant) return;
      this.setData({
        editing: !this.data.editing,
        shopName: this.data.merchant.shopName,
        contactPhone: this.data.merchant.contactPhone,
      });
    },

    onInput(e: WechatMiniprogram.Input) {
      const field = e.currentTarget.dataset.field as 'shopName' | 'contactPhone';
      this.setData({ [field]: e.detail.value } as Record<string, string>);
    },

    async save() {
      if (this.data.saving) return;
      this.setData({ saving: true });
      try {
        const { updateMerchantProfile } = await import('../../../services/merchant');
        const m = await updateMerchantProfile({
          shopName: this.data.shopName,
          contactPhone: this.data.contactPhone,
        });
        this.setData({ merchant: m, editing: false });
        wx.showToast({ title: '已保存', icon: 'success' });
      } catch {
        /* toast 已弹 */
      } finally {
        this.setData({ saving: false });
      }
    },

    // M5-01 商家工作台菜单
    // 同端 tab 跳转 -> switchtab 事件冒泡 shell
    goJobs() {
      this.triggerEvent('switchtab', { tab: 'jobs' });
    },
    goCandidates() {
      this.triggerEvent('switchtab', { tab: 'candidates' });
    },
    goPostJob() {
      this.triggerEvent('switchtab', { tab: 'post' });
    },
    goNotifications() {
      this.triggerEvent('switchtab', { tab: 'notifications' });
    },
    // 二级页 -> 保留 navigateTo
    goOrders() {
      wx.navigateTo({ url: '/pages/merchant/orders/index' });
    },
    goReviews() {
      wx.navigateTo({ url: '/pages/merchant/reviews/index' });
    },
    goDashboard() {
      wx.navigateTo({ url: '/pages/merchant/dashboard/index' });
    },
    goFeedback() {
      wx.navigateTo({ url: '/pages/feedback/index' });
    },
    goHelp() {
      wx.navigateTo({ url: '/pages/help/index' });
    },
    goSettings() {
      wx.navigateTo({ url: '/pages/settings/index' });
    },
    goRegister() {
      wx.navigateTo({ url: '/pages/merchant/register/index' });
    },
    // 商家驳回后重新提交资质入口：带 ?mode=resubmit 跳到 register 页
    goReapply() {
      wx.navigateTo({ url: '/pages/merchant/register/index?mode=resubmit' });
    },
    goAccountSecurity() {
      wx.navigateTo({ url: '/pages/account-security/index' });
    },

    logout() {
      wx.showModal({
        title: '退出登录',
        content: '将返回角色选择页',
        success: (r) => {
          if (r.confirm) {
            getApp<AppInstance>().logout();
          }
        },
      });
    },
  },
});
