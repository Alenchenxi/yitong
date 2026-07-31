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
  // M2-04/05 标记字段
  contactedAt: string | null;
  fitMark: 'FIT' | 'UNFIT' | null;
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
  contacted?: 0 | 1; // M2-04 1=已联系 0=未联系
  fitMark?: 'FIT' | 'UNFIT'; // M2-05
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export function listMerchantCandidates(filter: MerchantCandidateFilter = {}) {
  const params: string[] = [];
  if (filter.jobPostId) params.push(`jobPostId=${encodeURIComponent(filter.jobPostId)}`);
  if (filter.status) params.push(`status=${filter.status}`);
  if (filter.contacted !== undefined) params.push(`contacted=${filter.contacted}`);
  if (filter.fitMark) params.push(`fitMark=${filter.fitMark}`);
  if (filter.keyword) params.push(`keyword=${encodeURIComponent(filter.keyword)}`);
  params.push(`page=${filter.page ?? 1}`);
  params.push(`pageSize=${filter.pageSize ?? 20}`);
  return request<MerchantCandidatePage>({ url: `/merchant/candidates?${params.join('&')}` });
}

// M2-03 看过我列表
export interface MerchantViewerVo {
  userId: string;
  userNickname: string;
  jobPostId: string;
  jobPostTitle: string;
  viewedAt: string;
  applied: boolean;
}

export interface MerchantViewerPage {
  list: MerchantViewerVo[];
  total: number;
  page: number;
  pageSize: number;
}

export function listMerchantViewers(filter: { jobPostId?: string; page?: number; pageSize?: number } = {}) {
  const params: string[] = [];
  if (filter.jobPostId) params.push(`jobPostId=${encodeURIComponent(filter.jobPostId)}`);
  params.push(`page=${filter.page ?? 1}`);
  params.push(`pageSize=${filter.pageSize ?? 20}`);
  return request<MerchantViewerPage>({ url: `/merchant/viewers?${params.join('&')}` });
}

// M2-04 标记/取消 已联系
export function markCandidateContacted(appId: string, contacted: boolean) {
  return request<{ id: string; jobPostTitle: string; contactedAt: string | null; fitMark: 'FIT' | 'UNFIT' | null }>({
    url: `/merchant/candidates/${appId}/contact`,
    method: 'POST',
    data: { contacted },
  });
}

// M2-05 标记/取消 合适·不合适（fitMark=null 清除）
export function markCandidateFit(appId: string, fitMark: 'FIT' | 'UNFIT' | null) {
  return request<{ id: string; jobPostTitle: string; contactedAt: string | null; fitMark: 'FIT' | 'UNFIT' | null }>({
    url: `/merchant/candidates/${appId}/fit`,
    method: 'POST',
    data: { fitMark },
  });
}

// M2-06 批量标记
export interface BatchMarkResult {
  processed: Array<{ id: string; ok: boolean; error?: string }>;
}

export function batchMarkCandidates(data: {
  ids: string[];
  mark: 'contacted' | 'fit';
  contacted?: boolean;
  fitMark?: 'FIT' | 'UNFIT' | null;
}) {
  return request<BatchMarkResult>({ url: '/merchant/candidates/batch-mark', method: 'POST', data });
}

// M2-07 候选人详情
export interface CandidateHistoryItem {
  type: 'STATUS' | 'CONTACT';
  action: string;
  label: string;
  at: string;
}

export interface MerchantCandidateDetailVo {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DONE' | 'CANCELLED' | 'REJECTED';
  createdAt: string;
  contactedAt: string | null;
  fitMark: 'FIT' | 'UNFIT' | null;
  user: { id: string; nickname: string; avatarUrl: string | null };
  jobPost: {
    id: string;
    title: string;
    description: string;
    requirements: string | null;
    salary: string;
    location: string;
    category: string | null;
    settlement: string | null;
    workDates: string[];
    workPeriods: string[];
    headcount: number;
    urgent: boolean;
    online: boolean;
    questions: string[];
    expireAt: string;
    status: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
  };
  resume: {
    id: string;
    name: string;
    phone: string;
    selfIntro: string | null;
    skills: string[];
    availabilities: string[];
    experience: string | null;
    completeness: number;
    missingFields: string[];
    updatedAt: string;
  } | null;
  answers: Array<{ question: string; answer: string }> | null;
  history: CandidateHistoryItem[];
}

export function getMerchantCandidateDetail(id: string) {
  return request<MerchantCandidateDetailVo>({ url: `/merchant/candidates/${id}` });
}

// M4-02 报名处理提醒（懒检查）：商家进消息页触发，超时未联系 PENDING 报名产生站内提醒
export interface ApplyReminderResult {
  created: boolean;
  count: number;
}

export function checkApplyReminder() {
  return request<ApplyReminderResult>({ url: '/merchant/apply-reminder', method: 'POST' });
}
