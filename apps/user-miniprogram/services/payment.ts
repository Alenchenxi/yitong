import { request } from './request';

export interface PublishOrderVo {
  orderId: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CLOSED';
  jobPostId: string;
  jobPostStatus: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
}

export function publishJob(data: { jobPostId: string; duration: 'D30' | 'D90' }) {
  return request<PublishOrderVo>({ url: '/payments/job-publish', method: 'POST', data });
}
