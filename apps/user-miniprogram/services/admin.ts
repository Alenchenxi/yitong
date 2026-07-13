import { request } from './request';

export interface AdminQueueVo {
  merchants: Array<{
    id: string;
    shopName: string;
    licenseNo: string;
    contactPhone: string;
    status: string;
    userId: string;
    userNickname: string;
    createdAt: string;
  }>;
  posts: Array<{
    id: string;
    content: string;
    status: string;
    authorNickname: string;
    circleName: string;
    createdAt: string;
  }>;
  anonPosts: Array<{
    id: string;
    content: string;
    anonId: string;
    status: string;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    targetType: string;
    targetId: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export interface PricingVo {
  duration: 'D30' | 'D90';
  price: string;
  updatedAt: string;
}

export function getQueue() {
  return request<AdminQueueVo>({ url: '/admin/queue' });
}
export function approveMerchant(id: string, reason?: string) {
  return request({ url: `/admin/merchants/${id}/approve`, method: 'POST', data: { reason } });
}
export function rejectMerchant(id: string, reason?: string) {
  return request({ url: `/admin/merchants/${id}/reject`, method: 'POST', data: { reason } });
}
export function batchMerchants(ids: string[], action: 'approve' | 'reject', reason?: string) {
  return request({ url: '/admin/merchants/batch', method: 'POST', data: { ids, action, reason } });
}
export function takedownPost(id: string, reason?: string) {
  return request({ url: `/admin/posts/${id}/takedown`, method: 'POST', data: { reason } });
}
export function takedownAnonPost(id: string, reason?: string) {
  return request({ url: `/admin/anon-posts/${id}/takedown`, method: 'POST', data: { reason } });
}
export function getPricing() {
  return request<PricingVo[]>({ url: '/admin/pricing' });
}
export function updatePricing(data: { duration: 'D30' | 'D90'; price: number }) {
  return request({ url: '/admin/pricing', method: 'PUT', data });
}
