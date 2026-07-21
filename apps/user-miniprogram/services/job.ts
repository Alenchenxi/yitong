import { request } from './request';

// P0-17 岗位分类 / 结算方式（与后端枚举对齐）
export type JobCategory =
  | 'CATERING'
  | 'RETAIL'
  | 'PROMOTION'
  | 'EXHIBITION'
  | 'TUTORING'
  | 'CAMPUS_AGENT'
  | 'ONLINE'
  | 'SURVEY'
  | 'INTERNSHIP'
  | 'LONG_TERM';
export type Settlement = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'COMPLETION';

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  CATERING: '餐饮',
  RETAIL: '零售',
  PROMOTION: '促销',
  EXHIBITION: '展会',
  TUTORING: '家教',
  CAMPUS_AGENT: '校园代理',
  ONLINE: '线上兼职',
  SURVEY: '问卷/调研',
  INTERNSHIP: '实习',
  LONG_TERM: '长期兼职',
};
export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  DAILY: '日结',
  WEEKLY: '周结',
  MONTHLY: '月结',
  COMPLETION: '完工结',
};

export interface JobPostVo {
  id: string;
  merchantId: string;
  merchantShopName: string;
  title: string;
  description: string;
  salary: string;
  salaryAmount: number | null; // P0-18 薪资数额（auto-parse，范围筛选用）
  location: string;
  category: JobCategory | null; // P0-17 分类
  settlement: Settlement | null; // P0-17 结算方式
  workDates: string[]; // P0-17 工作日期
  workPeriods: string[]; // P0-17 工作时段
  headcount: number; // P0-17 招聘人数
  urgent: boolean; // P0-17 急招
  online: boolean; // P0-17 是否可线上
  duration: 'D30' | 'D90';
  expireAt: string;
  status: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
  createdAt: string;
}

export interface JobListResult {
  list: JobPostVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface JobAppVo {
  id: string;
  jobPostId: string;
  jobPostTitle: string;
  userId: string;
  userNickname: string;
  status: 'PENDING' | 'ACCEPTED' | 'DONE' | 'CANCELLED';
  createdAt: string;
}

export interface JobReviewVo {
  id: string;
  applicationId: string;
  reviewerId: string;
  rating: number;
  content: string;
  createdAt: string;
}

export function createJobPost(data: {
  title: string;
  description: string;
  salary: string;
  location: string;
  category: JobCategory;
  settlement: Settlement;
  workDates?: string[];
  workPeriods?: string[];
  headcount?: number;
  urgent?: boolean;
  online?: boolean;
  duration: 'D30' | 'D90';
}) {
  return request<JobPostVo>({ url: '/job-posts', method: 'POST', data });
}

export interface JobListFilter {
  cursor?: string;
  mine?: boolean;
  urgent?: boolean;
  keyword?: string; // P0-18 关键词
  category?: JobCategory; // P0-18 分类
  settlement?: Settlement; // P0-18 结算方式
  location?: string; // P0-18 工作地点
  salaryMin?: number; // P0-18 薪资下限
  salaryMax?: number; // P0-18 薪资上限
  online?: boolean; // P0-18 仅看线上
}

export function listJobPosts(filter: JobListFilter = {}) {
  const params: string[] = [];
  if (filter.mine) params.push('mine=1');
  if (filter.urgent) params.push('urgent=1');
  if (filter.online) params.push('online=1');
  if (filter.keyword) params.push(`keyword=${encodeURIComponent(filter.keyword)}`);
  if (filter.category) params.push(`category=${filter.category}`);
  if (filter.settlement) params.push(`settlement=${filter.settlement}`);
  if (filter.location) params.push(`location=${encodeURIComponent(filter.location)}`);
  if (filter.salaryMin !== undefined) params.push(`salaryMin=${filter.salaryMin}`);
  if (filter.salaryMax !== undefined) params.push(`salaryMax=${filter.salaryMax}`);
  params.push('limit=20');
  if (filter.cursor) params.push(`cursor=${encodeURIComponent(filter.cursor)}`);
  return request<JobListResult>({ url: `/job-posts?${params.join('&')}` });
}

export function recommendJobs() {
  return request<JobPostVo[]>({ url: '/job-posts/recommend' });
}

export function getJobPost(id: string) {
  return request<JobPostVo>({ url: `/job-posts/${id}` });
}

export function applyJob(postId: string) {
  return request<JobAppVo>({ url: `/job-posts/${postId}/applications`, method: 'POST' });
}

export function listPostApplications(postId: string) {
  return request<JobAppVo[]>({ url: `/job-posts/${postId}/applications` });
}

export function listPostReviews(postId: string) {
  return request<JobReviewVo[]>({ url: `/job-posts/${postId}/reviews` });
}

export function listMyApplications() {
  return request<JobAppVo[]>({ url: '/applications/me' });
}

export function transitionApp(appId: string, action: 'accept' | 'complete') {
  return request<JobAppVo>({ url: `/applications/${appId}/transition`, method: 'POST', data: { action } });
}

export function reviewApp(appId: string, data: { rating: number; content: string }) {
  return request<JobReviewVo>({ url: `/applications/${appId}/review`, method: 'POST', data });
}
