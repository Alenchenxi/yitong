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
    if (item?.targetType && item.targetId) {
      this.goTarget(item.targetType, item.targetId, item.extraId);
    }
  },

  goTarget(targetType: string, targetId: string, extraId?: string | null) {
    if (targetType === 'post') {
      // P1-01：评论/回复通知带 commentId，详情页定位到具体评论
      const anchor = extraId ? `&commentId=${extraId}` : '';
      wx.navigateTo({ url: `/pages/post-detail/index?id=${targetId}${anchor}` });
    } else if (targetType === 'anon_post' || targetType === 'anon-post') {
      wx.navigateTo({ url: `/pages/treehole/detail/index?id=${targetId}` });
    } else if (targetType === 'job_post') {
      wx.navigateTo({ url: `/pages/job/detail/index?id=${targetId}` });
    } else if (targetType === 'application') {
      wx.navigateTo({ url: '/pages/job/my-applications/index' });
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
