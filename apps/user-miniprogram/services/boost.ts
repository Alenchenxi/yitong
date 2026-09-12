import { request } from './request';
import type { VirtualPayParams } from './payment';

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
  // 生产环境拉起虚拟支付（道具直购）所需参数；dev mock 直接完成时为 null
  virtualPayParams: VirtualPayParams | null;
}

export function listBoostPlans() {
  return request<BoostPlanVo[]>({ url: '/boost/plans' });
}

export function createBoostOrder(data: { targetType: 'post' | 'anon_post'; targetId: string; planCode: string }) {
  return request<BoostOrderVo>({ url: '/payments/post-boost', method: 'POST', data });
}
