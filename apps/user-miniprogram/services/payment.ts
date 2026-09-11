import { request } from './request';

export interface WxPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  // V3 改为 RSA 签名（V2 用 MD5）
  signType: 'RSA';
  paySign: string;
}

// 虚拟支付（道具直购）拉起参数：后端算好的三要素，前端必须原样透传给
// wx.requestVirtualPayment，禁止重新序列化 signData（微信对 key 顺序敏感）
export interface VirtualPayParams {
  signData: string;
  paySig: string;
  signature: string;
  mode: string; // 道具直购固定 'short_series_goods'
}

export interface PublishOrderVo {
  orderId: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDING' | 'REFUNDED' | 'CLOSED';
  jobPostId: string;
  jobPostStatus: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';
  // 2026 虚拟支付管理规范：岗位付费发布走虚拟支付道具直购；dev mock 直接完成时为 null
  virtualPayParams: VirtualPayParams | null;
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
