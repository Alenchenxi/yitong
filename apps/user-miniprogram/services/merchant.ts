import { request } from './request';

export interface MerchantVo {
  id: string;
  userId: string;
  shopName: string;
  licenseNo: string;
  contactPhone: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export function registerMerchant(data: {
  shopName: string;
  licenseNo: string;
  contactPhone: string;
}) {
  return request<MerchantVo>({ url: '/merchant/register', method: 'POST', data });
}

export function getMerchantProfile() {
  return request<MerchantVo>({ url: '/merchant/profile' });
}

export function updateMerchantProfile(data: { shopName?: string; contactPhone?: string }) {
  return request<MerchantVo>({ url: '/merchant/profile', method: 'PUT', data });
}

export interface MerchantReviewVo {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  jobPostTitle: string;
  reviewerNickname: string;
}

export interface MerchantOrderVo {
  id: string;
  jobPostId: string;
  jobPostTitle: string;
  duration: 'D30' | 'D90';
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CLOSED';
  paidAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
}

export function getMerchantReviews() {
  return request<MerchantReviewVo[]>({ url: '/merchant/reviews' });
}

export function getMerchantOrders() {
  return request<MerchantOrderVo[]>({ url: '/merchant/orders' });
}
