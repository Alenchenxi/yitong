import { request } from './request';

export interface JobPostVo {
  id: string;
  merchantId: string;
  merchantShopName: string;
  title: string;
  description: string;
  salary: string;
  location: string;
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
  duration: 'D30' | 'D90';
}) {
  return request<JobPostVo>({ url: '/job-posts', method: 'POST', data });
}

export function listJobPosts(cursor?: string, mine = false) {
  const qs = `?${mine ? 'mine=1&' : ''}limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return request<JobListResult>({ url: `/job-posts${qs}` });
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
