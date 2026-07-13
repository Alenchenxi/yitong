import { request } from './request';

export interface AnnouncementVo {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface AdminAnnouncementVo extends AnnouncementVo {
  active: boolean;
  updatedAt: string;
}

export function listAnnouncements() {
  return request<AnnouncementVo[]>({ url: '/announcements' });
}

export function listAllAnnouncements() {
  return request<AdminAnnouncementVo[]>({ url: '/announcements/all' });
}

export function createAnnouncement(data: { title: string; content: string }) {
  return request<AdminAnnouncementVo>({ url: '/announcements', method: 'POST', data });
}

export function updateAnnouncement(id: string, data: { title?: string; content?: string; active?: boolean }) {
  return request<AdminAnnouncementVo>({ url: `/announcements/${id}`, method: 'PUT', data });
}

export function deleteAnnouncement(id: string) {
  return request({ url: `/announcements/${id}`, method: 'DELETE' });
}
