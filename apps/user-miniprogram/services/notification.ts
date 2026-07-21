import { request } from './request';

export interface NotificationVo {
  id: string;
  type: string;
  title: string;
  content: string;
  targetType: string | null;
  targetId: string | null;
  extraId: string | null; // P1-01 附属定位 id（评论通知的 commentId）
  read: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  list: NotificationVo[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

export function listNotifications(unreadOnly = false, page = 1) {
  const qs = `?unreadOnly=${unreadOnly ? 1 : 0}&page=${page}&pageSize=20`;
  return request<NotificationListResult>({ url: `/notifications${qs}` });
}

export function markNotificationRead(id: string) {
  return request({ url: `/notifications/${id}/read`, method: 'POST' });
}

export function markAllNotificationsRead() {
  return request({ url: '/notifications/read-all', method: 'POST' });
}
