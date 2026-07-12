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
}

export interface PricingVo {
  duration: 'D30' | 'D90';
  price: string;
  updatedAt: string;
}

export function getQueue() {
  return request<AdminQueueVo>({ url: '/admin/queue' });
}
export function approveMerchant(id: string) {
  return request({ url: `/admin/merchants/${id}/approve`, method: 'POST' });
}
export function rejectMerchant(id: string) {
  return request({ url: `/admin/merchants/${id}/reject`, method: 'POST' });
}
export function takedownPost(id: string) {
  return request({ url: `/admin/posts/${id}/takedown`, method: 'POST' });
}
export function takedownAnonPost(id: string) {
  return request({ url: `/admin/anon-posts/${id}/takedown`, method: 'POST' });
}
export function getPricing() {
  return request<PricingVo[]>({ url: '/admin/pricing' });
}
export function updatePricing(data: { duration: 'D30' | 'D90'; price: number }) {
  return request({ url: '/admin/pricing', method: 'PUT', data });
}
