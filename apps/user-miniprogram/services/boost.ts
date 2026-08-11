import { request } from './request';
import type { WxPayParams } from './payment';

// 内容推广（付费置顶曝光）：档位 + 下单
export interface BoostPlanVo {
  code: string;
  name: string;
  durationHours: number;
  price: string;
}

export interface BoostOrderVo {
  orderId: string;
  amount: string;
  status: 'PENDING' | 'PAID' | 'REFUNDING' | 'REFUNDED' | 'CLOSED';
  targetType: 'post' | 'anon_post';
  targetId: string;
  boostUntil: string | null;
  // 生产环境拉起微信支付所需参数；dev mock 直接完成时为 null
  wxPayParams: WxPayParams | null;
}

export function listBoostPlans() {
  return request<BoostPlanVo[]>({ url: '/boost/plans' });
}

export function createBoostOrder(data: { targetType: 'post' | 'anon_post'; targetId: string; planCode: string }) {
  return request<BoostOrderVo>({ url: '/payments/post-boost', method: 'POST', data });
}
