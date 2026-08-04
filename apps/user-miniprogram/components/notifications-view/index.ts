import type { AppInstance } from '../../app';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCounts,
  type NotificationVo,
  type NotificationCategory,
  type UnreadCounts,
} from '../../services/notification';
import { requestJobApplySubscribe, requestJobStatusSubscribe } from '../../services/subscribe-message';
import { checkApplyReminder } from '../../services/merchant';
import { formatTime } from '../../utils/auth';

const CATEGORIES: Array<{ value: '' | NotificationCategory; label: string }> = [
  { value: '', label: '全部' },
  { value: 'apply', label: '报名' },
  { value: 'system', label: '系统' },
  { value: 'order', label: '订单' },
];

// 消息列表共用视图：用户端独立页（pages/notifications 薄壳）+ 商家 shell notifications panel 共用
// 不用 pageLifetimes.show（商家 shell 内会刷隐藏 panel）；由宿主 onShow/onReady / onPanelShow 调 refresh()
// merchant_candidates 跳转事件化交宿主（用户端 navigateTo / 商家 panel switchtab 切 tab）
Component({
  options: {
    addGlobalClass: true,
  },

  data: {
    activeCategory: '' as '' | NotificationCategory,
    categories: CATEGORIES,
    notifications: [] as Array<NotificationVo & { timeText: string }>,
    unreadCount: 0,
    unreadCounts: { apply: 0, system: 0, order: 0 } as UnreadCounts,
    loading: false,
    isMerchant: false,
  },

  methods: {
    /** 宿主调用刷新（用户端薄壳 onShow/onReady / 商家 panel onPanelShow） */
    async refresh() {
      const app = getApp<AppInstance>();
      if (!app.requireAuth()) return;
      const role = app.globalData.currentRole;
      this.setData({ isMerchant: role === 'MERCHANT' });
      // M4-02 报名处理提醒（懒检查）：商家进消息页先检查，超时未联系 PENDING 报名产生站内提醒
      if (role === 'MERCHANT') {
        try { await checkApplyReminder(); } catch { /* 不影响列表加载 */ }
      }
      await Promise.all([this.load(), this.loadUnreadCounts()]);
    },

    async load() {
      this.setData({ loading: true });
      try {
        const resp = await listNotifications(false, 1, this.data.activeCategory || undefined);
        this.setData({
          notifications: resp.list.map((n) => ({ ...n, timeText: formatTime(n.createdAt) })),
          unreadCount: resp.unreadCount,
        });
      } catch {
        /* toast */
      } finally {
        this.setData({ loading: false });
      }
    },

    async loadUnreadCounts() {
      try {
        const counts = await getUnreadCounts();
        this.setData({ unreadCounts: counts });
      } catch {
        /* 忽略 */
      }
    },

    async onCategoryTap(e: WechatMiniprogram.TouchEvent) {
      const value = e.currentTarget.dataset.value as '' | NotificationCategory;
      if (value === this.data.activeCategory) return;
      this.setData({ activeCategory: value });
      await this.load();
    },

    async tapNotification(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id as string;
      const item = this.data.notifications.find((n) => n.id === id);
      if (item && !item.read) {
        await markNotificationRead(id);
        const newUnread = Math.max(0, this.data.unreadCount - 1);
        const cat = this.categoryForType(item.type);
        this.setData({
          notifications: this.data.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
          unreadCount: newUnread,
          unreadCounts: {
            ...this.data.unreadCounts,
            [cat]: Math.max(0, this.data.unreadCounts[cat] - 1),
          } as UnreadCounts,
        });
      }
      if (item?.targetType && item.targetId) {
        this.goTarget(item.targetType, item.targetId, item.extraId);
      }
    },

    categoryForType(type: string): NotificationCategory {
      if (['job_apply', 'job_accept', 'job_complete', 'job_reject', 'job_review_from_merchant', 'job_apply_reminder'].includes(type)) {
        return 'apply';
      }
      return 'system';
    },

    goTarget(targetType: string, targetId: string, extraId?: string | null) {
      if (targetType === 'post') {
        const anchor = extraId ? `&commentId=${extraId}` : '';
        wx.navigateTo({ url: `/pages/post-detail/index?id=${targetId}${anchor}` });
      } else if (targetType === 'user') {
        wx.navigateTo({ url: '/pages/account-security/index' });
      } else if (targetType === 'anon_post' || targetType === 'anon-post') {
        wx.navigateTo({ url: `/pages/treehole/detail/index?id=${targetId}` });
      } else if (targetType === 'job_post') {
        wx.navigateTo({ url: `/pages/job/detail/index?id=${targetId}` });
      } else if (targetType === 'application') {
        wx.navigateTo({ url: '/pages/job/my-applications/index' });
      } else if (targetType === 'merchant_candidates') {
        // candidates 非 tabBar 页，事件化交宿主：用户端薄壳 navigateTo / 商家 panel switchtab 切 tab
        this.triggerEvent('opencandidates');
      }
    },

    async readAll() {
      if (this.data.unreadCount === 0) return;
      await markAllNotificationsRead();
      this.setData({
        notifications: this.data.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
        unreadCounts: { apply: 0, system: 0, order: 0 },
      });
      wx.showToast({ title: '全部已读', icon: 'success' });
    },

    // M4-04 微信订阅授权入口
    async enableApplySubscribe() {
      const ok = await requestJobApplySubscribe();
      wx.showToast({
        title: ok ? '已开启报名提醒' : '授权未生效',
        icon: ok ? 'success' : 'none',
      });
    },

    async enableStatusSubscribe() {
      const ok = await requestJobStatusSubscribe();
      wx.showToast({
        title: ok ? '已开启状态提醒' : '授权未生效',
        icon: ok ? 'success' : 'none',
      });
    },
  },
});
