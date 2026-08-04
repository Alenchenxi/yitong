import { request } from './request';

export interface WxPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  // V3 改为 RSA 签名（V2 用 MD5）
  signType: 'RSA';
  paySign: string;
}

export interface PublishOrderVo {
  orderId: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDING' | 'REFUNDED' | 'CLOSED';
  jobPostId: string;
  jobPostStatus: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
  // 生产环境拉起微信支付所需参数；dev mock 直接完成时为 null
  wxPayParams: WxPayParams | null;
}

export interface PaymentOrderVo {
  orderId: string;
  jobPostId: string;
  duration: 'D30' | 'D90';
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDING' | 'REFUNDED' | 'CLOSED';
  paidAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  wxTransactionId: string | null;
  wxRefundId: string | null;
  refundStatus: string | null;
  createdAt: string;
}

export interface SyncOrderVo extends PaymentOrderVo {
  message: string;
}

export function publishJob(data: { jobPostId: string; duration: 'D30' | 'D90' }) {
  return request<PublishOrderVo>({ url: '/payments/job-publish', method: 'POST', data });
}

// 发布岗位单价预览（D30/D90）：支付页展示用
export interface JobPublishPriceVo {
  duration: 'D30' | 'D90';
  price: string;
}

export function getJobPublishPricing() {
  return request<JobPublishPriceVo[]>({ url: '/payments/job-publish/price' });
}

export function refundPayment(orderId: string, reason?: string) {
  return request<PaymentOrderVo>({
    url: `/payments/${orderId}/refund`,
    method: 'POST',
    data: { reason },
  });
}

// M6-05 订单状态兜底查询：按微信真实状态对账本地
export function syncOrderStatus(orderId: string) {
  return request<SyncOrderVo>({ url: `/payments/${orderId}/sync`, method: 'POST' });
}
