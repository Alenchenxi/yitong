/* eslint-disable no-console */
// FakePrisma + 简化 PaymentService(只跑 createJobPublishOrder / getJobPublishPricing / mockPay)
// 用于 job-publish-flow.smoke.ts 的 T4 子测试
// 不依赖真实 prisma / nestjs / db
import { BizException } from '../../src/common/exceptions/biz.exception';
import { HttpStatus } from '@nestjs/common';

// 简化的 FakePrisma
export interface FakeMerchant {
  id: string;
  userId: string;
  status: string;
}
export interface FakeJobPost {
  id: string;
  merchantId: string;
  status: string;
  title: string;
}
export interface FakePricingConfig {
  duration: string;
  price: number;
}
export interface FakePaymentOrder {
  id: string;
  scene: string;
  status: string;
  amount: number;
  merchantId: string | null;
  jobPostId: string | null;
  duration: string | null;
}

export interface FakePrismaHandle {
  merchants: FakeMerchant[];
  jobPosts: FakeJobPost[];
  pricingConfigs: FakePricingConfig[];
  paymentOrders: FakePaymentOrder[];
  paymentOrderUpdate: (id: string, patch: Partial<FakePaymentOrder>) => FakePaymentOrder;
  jobPostUpdate: (id: string, patch: Partial<FakeJobPost>) => FakeJobPost;
  $transaction: <T>(fn: (tx: FakePrismaHandle) => Promise<T>) => Promise<T>;
}

export function buildFakePrisma(): FakePrismaHandle {
  const merchants: FakeMerchant[] = [];
  const jobPosts: FakeJobPost[] = [];
  const pricingConfigs: FakePricingConfig[] = [];
  const paymentOrders: FakePaymentOrder[] = [];
  let nextOrderId = 1;
  const handle: FakePrismaHandle = {
    merchants,
    jobPosts,
    pricingConfigs,
    paymentOrders,
    paymentOrderUpdate: (id, patch) => {
      const o = paymentOrders.find((x) => x.id === id);
      if (!o) throw new Error(`order ${id} not found`);
      Object.assign(o, patch);
      return o;
    },
    jobPostUpdate: (id, patch) => {
      const p = jobPosts.find((x) => x.id === id);
      if (!p) throw new Error(`post ${id} not found`);
      Object.assign(p, patch);
      return p;
    },
    $transaction: async (fn) => fn(handle),
  };
  void nextOrderId;
  return handle;
}

// 简化 PaymentService:只实现冒烟测试需要的 3 个方法
// mock 路径:createJobPublishOrder 直接完成(模拟 dev mode 无 wxPay)
export function createPaymentServiceForTest(fake: FakePrismaHandle) {
  const isReady = false; // 模拟 wxPay.isReady() = false → dev mock
  void isReady;

  return {
    async createJobPublishOrder(merchantUid: string, dto: { jobPostId: string; duration: 'D30' | 'D90' }) {
      const merchant = fake.merchants.find((m) => m.userId === merchantUid);
      if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
      const post = fake.jobPosts.find((p) => p.id === dto.jobPostId);
      if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
      if (post.merchantId !== merchant.id) {
        throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
      }
      if (post.status !== 'PENDING') {
        throw new BizException(50002, '岗位已发布或已下架', HttpStatus.CONFLICT);
      }
      const pricing = fake.pricingConfigs.find((p) => p.duration === dto.duration);
      if (!pricing) throw new BizException(50004, '该档位单价未配置', HttpStatus.CONFLICT);

      const order: FakePaymentOrder = {
        id: `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        scene: 'JOB_PUBLISH',
        status: 'PENDING',
        amount: pricing.price,
        merchantId: merchant.id,
        jobPostId: post.id,
        duration: dto.duration,
      };
      fake.paymentOrders.push(order);

      // dev mock:直接完成
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信支付凭证未配置', HttpStatus.SERVICE_UNAVAILABLE);
      }
      await this.fulfillOrder(order.id);
      const refreshed = fake.paymentOrders.find((o) => o.id === order.id)!;
      return {
        orderId: order.id,
        amount: String(refreshed.amount),
        status: refreshed.status,
        jobPostId: post.id,
        jobPostStatus: 'PUBLISHED',
        wxPayParams: null,
      };
    },

    async fulfillOrder(orderId: string) {
      const o = fake.paymentOrders.find((x) => x.id === orderId);
      if (!o) return;
      o.status = 'PAID';
      if (o.jobPostId) {
        const p = fake.jobPosts.find((x) => x.id === o.jobPostId);
        if (p) p.status = 'PUBLISHED';
      }
    },

    async getJobPublishPricing() {
      return fake.pricingConfigs.map((p) => ({ duration: p.duration, price: String(p.price) }));
    },

    async mockPay(orderId: string) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(10003, 'prod 禁止 mock 支付', HttpStatus.FORBIDDEN);
      }
      await this.fulfillOrder(orderId);
      const o = fake.paymentOrders.find((x) => x.id === orderId);
      return { orderId, status: o?.status ?? 'PAID' };
    },
  };
}
