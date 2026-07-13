import type { AppInstance } from '../../app';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationVo,
} from '../../services/notification';
import { formatTime } from '../../utils/auth';

Page({
  data: {
    notifications: [] as Array<NotificationVo & { timeText: string }>,
    unreadCount: 0,
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
      const resp = await listNotifications(false, 1);
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

  async tapNotification(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string;
    const item = this.data.notifications.find((n) => n.id === id);
    if (item && !item.read) {
      await markNotificationRead(id);
      this.setData({
        notifications: this.data.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, this.data.unreadCount - 1),
      });
    }
  },

  async readAll() {
    if (this.data.unreadCount === 0) return;
    await markAllNotificationsRead();
    this.setData({
      notifications: this.data.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    });
    wx.showToast({ title: '全部已读', icon: 'success' });
  },
});
