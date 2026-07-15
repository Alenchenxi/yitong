import { request } from './request';

export interface PublishOrderVo {
  orderId: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CLOSED';
  jobPostId: string;
  jobPostStatus: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
}

export interface PaymentOrderVo {
  orderId: string;
  jobPostId: string;
  duration: 'D30' | 'D90';
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDED' | 'CLOSED';
  paidAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
}

export function publishJob(data: { jobPostId: string; duration: 'D30' | 'D90' }) {
  return request<PublishOrderVo>({ url: '/payments/job-publish', method: 'POST', data });
}

export function refundPayment(orderId: string, reason?: string) {
  return request<PaymentOrderVo>({
    url: `/payments/${orderId}/refund`,
    method: 'POST',
    data: { reason },
  });
}
