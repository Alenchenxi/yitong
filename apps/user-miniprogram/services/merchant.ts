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

// M2-01 跨岗位候选人聚合
export interface MerchantCandidateVo {
  id: string;
  jobPostId: string;
  jobPostTitle: string;
  userId: string;
  userNickname: string;
  resumeId: string | null;
  resume: { name: string; phone: string; selfIntro: string | null; skills: string[] } | null;
  status: 'PENDING' | 'ACCEPTED' | 'DONE' | 'CANCELLED' | 'REJECTED';
  createdAt: string;
}

export interface MerchantCandidatePage {
  list: MerchantCandidateVo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MerchantCandidateFilter {
  jobPostId?: string;
  status?: MerchantCandidateVo['status'];
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export function listMerchantCandidates(filter: MerchantCandidateFilter = {}) {
  const params: string[] = [];
  if (filter.jobPostId) params.push(`jobPostId=${encodeURIComponent(filter.jobPostId)}`);
  if (filter.status) params.push(`status=${filter.status}`);
  if (filter.keyword) params.push(`keyword=${encodeURIComponent(filter.keyword)}`);
  params.push(`page=${filter.page ?? 1}`);
  params.push(`pageSize=${filter.pageSize ?? 20}`);
  return request<MerchantCandidatePage>({ url: `/merchant/candidates?${params.join('&')}` });
}
