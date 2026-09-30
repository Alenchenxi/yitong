import { JobDuration, type BoostPlan, type PricingConfig } from '@prisma/client';
import { BizException } from '../../src/common/exceptions/biz.exception';
import {
  XPAY_PRICE_SWITCHING_CODE,
  XpayPropSyncService,
  boostPropIdFor,
  xpayPropIdFor,
  yuanToFen,
} from '../../src/modules/payment/xpay-prop-sync.service';

// Decimal 只被 yuanToFen 调 toString()，字符串即可
const price5 = '5.00' as never;
const price90 = '90.00' as never;

function makePlan(overrides: Partial<Record<string, unknown>> = {}): BoostPlan {
  return {
    id: 'bp_1',
    code: 'BOOST_1D',
    name: '1天推广',
    durationHours: 24,
    price: price5,
    enabled: true,
    xpayProductId: null,
    xpayPropStatus: null,
    xpaySyncStep: null,
    xpaySyncStartedAt: null,
    xpayPublishedAt: null,
    xpaySyncError: null,
    ...overrides,
  } as unknown as BoostPlan;
}

function makePricing(overrides: Partial<Record<string, unknown>> = {}): PricingConfig {
  return {
    id: 'pc_1',
    duration: JobDuration.D30,
    price: price90,
    xpayProductId: null,
    xpayPropStatus: null,
    xpaySyncStep: null,
    xpaySyncStartedAt: null,
    xpayPublishedAt: null,
    xpaySyncError: null,
    ...overrides,
  } as unknown as PricingConfig;
}

function createDeps(overrides: { imageForBoost?: string } = {}) {
  const prisma = {
    pricingConfig: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
    boostPlan: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
  };
  const wxXPay = {
    isReady: jest.fn(() => true),
    startUploadGoods: jest.fn().mockResolvedValue(undefined),
    queryUploadGoods: jest.fn(),
    startPublishGoods: jest.fn().mockResolvedValue(undefined),
    queryPublishGoods: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'WX_XPAY_BOOST_PROP_IMAGE_URL'
        ? (overrides.imageForBoost ?? 'https://cdn.example.com/boost.png')
        : 'https://cdn.example.com/job.png',
    ),
  };
  const service = new XpayPropSyncService(prisma as never, config as never, wxXPay as never);
  return { prisma, wxXPay, config, service };
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

describe('XPAY 道具同步（双表泛化）', () => {
  describe('道具 ID 生成', () => {
    it('boostPropIdFor：BOOST_1D@5元 -> bt_1d_p500（≤20 字符）', () => {
      expect(boostPropIdFor('BOOST_1D', 500)).toBe('bt_1d_p500');
      expect(boostPropIdFor('BOOST_1D', 500).length).toBeLessThanOrEqual(20);
    });

    it('boostPropIdFor：剔非法字符，空段回退 x', () => {
      expect(boostPropIdFor('BOOST_3-DAY', 1200)).toBe('bt_3day_p1200');
      expect(boostPropIdFor('BOOST__', 100)).toBe('bt_x_p100');
    });

    it('xpayPropIdFor / yuanToFen 回归：D30@90元 -> jp_d30_p9000，5元 -> 500分', () => {
      expect(xpayPropIdFor(JobDuration.D30, 9000)).toBe('jp_d30_p9000');
      expect(yuanToFen(price5)).toBe(500);
    });
  });

  describe('50008 守卫（assertBoostPropReadyOrThrow）', () => {
    it('READY 已过生效缓冲（≥15min）：放行并返回道具 ID，不触库', () => {
      const d = createDeps();
      const plan = makePlan({
        xpayProductId: 'bt_1d_p500',
        xpayPropStatus: 'READY',
        xpayPublishedAt: minsAgo(16),
      });
      expect(d.service.assertBoostPropReadyOrThrow(plan)).toBe('bt_1d_p500');
      expect(d.prisma.boostPlan.update).not.toHaveBeenCalled();
    });

    it('READY 未过生效缓冲（<15min）：同步抛 50008，且不重复同步', () => {
      const d = createDeps();
      const plan = makePlan({
        xpayProductId: 'bt_1d_p500',
        xpayPropStatus: 'READY',
        xpayPublishedAt: minsAgo(5),
      });
      expect(() => d.service.assertBoostPropReadyOrThrow(plan)).toThrow(BizException);
      let err: BizException | undefined;
      try {
        d.service.assertBoostPropReadyOrThrow(plan);
      } catch (e) {
        err = e as BizException;
      }
      expect(err?.bizCode).toBe(XPAY_PRICE_SWITCHING_CODE);
      expect(d.prisma.boostPlan.update).not.toHaveBeenCalled();
      expect(d.wxXPay.startUploadGoods).not.toHaveBeenCalled();
    });

    it('从未同步（全 null）：同步抛 50008 且触发 begin 写 SYNCING/UPLOAD 并调上传 API', async () => {
      const d = createDeps();
      let err: BizException | undefined;
      try {
        d.service.assertBoostPropReadyOrThrow(makePlan());
      } catch (e) {
        err = e as BizException;
      }
      expect(err?.bizCode).toBe(XPAY_PRICE_SWITCHING_CODE);
      // beginRow 由 assert 内 void 触发（异步），冲刷微任务后再断言写库
      await Promise.resolve();
      expect(d.prisma.boostPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bp_1' },
          data: expect.objectContaining({
            xpayProductId: 'bt_1d_p500',
            xpayPropStatus: 'SYNCING',
            xpaySyncStep: 'UPLOAD',
          }),
        }),
      );
      expect(d.wxXPay.startUploadGoods).toHaveBeenCalledWith(expect.objectContaining({ id: 'bt_1d_p500' }));
    });
  });

  describe('同步状态机（boost 行）', () => {
    it('beginSyncBoostPlan：缺推广图直接 FAILED 并点名 env，不调上传 API', async () => {
      const d = createDeps({ imageForBoost: '' });
      await d.service.beginSyncBoostPlan(makePlan());
      expect(d.prisma.boostPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            xpayPropStatus: 'FAILED',
            xpaySyncError: expect.stringContaining('WX_XPAY_BOOST_PROP_IMAGE_URL'),
          }),
        }),
      );
      expect(d.wxXPay.startUploadGoods).not.toHaveBeenCalled();
    });

    it('beginSyncBoostPlan：上传撞 268490012 单槽互斥 -> 留 SYNCING，不置 FAILED', async () => {
      const d = createDeps();
      d.wxXPay.startUploadGoods.mockRejectedValue(new Error('90003: 268490012 任务运行中，稍后重试'));
      await d.service.beginSyncBoostPlan(makePlan());
      const failedCall = d.prisma.boostPlan.update.mock.calls.find(
        (c: unknown[]) => (c[0] as { data: { xpayPropStatus?: string } }).data.xpayPropStatus === 'FAILED',
      );
      expect(failedCall).toBeUndefined();
      expect(d.prisma.boostPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ xpayPropStatus: 'SYNCING' }) }),
      );
    });

    it('syncTick：UPLOAD 上传成功 -> 转 PUBLISH 并启动发布任务', async () => {
      const d = createDeps();
      d.prisma.boostPlan.findMany.mockResolvedValue([
        makePlan({
          xpayProductId: 'bt_1d_p500',
          xpayPropStatus: 'SYNCING',
          xpaySyncStep: 'UPLOAD',
          xpaySyncStartedAt: minsAgo(1),
        }),
      ]);
      d.wxXPay.queryUploadGoods.mockResolvedValue({ status: 2, items: [{ id: 'bt_1d_p500', uploadStatus: 2 }] });
      await d.service.syncTick();
      expect(d.wxXPay.startPublishGoods).toHaveBeenCalledWith('bt_1d_p500');
      expect(d.prisma.boostPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ xpaySyncStep: 'PUBLISH' }) }),
      );
    });

    it('syncTick：PUBLISH 发布成功 -> READY + 记录发布时间', async () => {
      const d = createDeps();
      d.prisma.boostPlan.findMany.mockResolvedValue([
        makePlan({
          xpayProductId: 'bt_1d_p500',
          xpayPropStatus: 'SYNCING',
          xpaySyncStep: 'PUBLISH',
          xpaySyncStartedAt: minsAgo(1),
        }),
      ]);
      d.wxXPay.queryPublishGoods.mockResolvedValue({ status: 2, items: [{ id: 'bt_1d_p500', publishStatus: 2 }] });
      await d.service.syncTick();
      expect(d.prisma.boostPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            xpayProductId: 'bt_1d_p500',
            xpayPropStatus: 'READY',
            xpaySyncStep: null,
            xpayPublishedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('cron 双表轮询', () => {
    it('syncTick 同时按 SYNCING 查两张表', async () => {
      const d = createDeps();
      await d.service.syncTick();
      expect(d.prisma.pricingConfig.findMany).toHaveBeenCalledWith({ where: { xpayPropStatus: 'SYNCING' } });
      expect(d.prisma.boostPlan.findMany).toHaveBeenCalledWith({ where: { xpayPropStatus: 'SYNCING' } });
    });

    it('轮询撞 268490012 不置 FAILED（等下一轮）', async () => {
      const d = createDeps();
      d.prisma.boostPlan.findMany.mockResolvedValue([
        makePlan({
          xpayProductId: 'bt_1d_p500',
          xpayPropStatus: 'SYNCING',
          xpaySyncStep: 'UPLOAD',
          xpaySyncStartedAt: minsAgo(1),
        }),
      ]);
      d.wxXPay.queryUploadGoods.mockRejectedValue(new Error('90003: 268490012 任务运行中'));
      await d.service.syncTick();
      expect(d.prisma.boostPlan.update).not.toHaveBeenCalled();
    });
  });

  describe('旧路回归（pricing 行，证泛化未破坏岗位发布）', () => {
    it('assertPropReadyOrThrow：READY 已过缓冲放行 jp_d30_p9000', () => {
      const d = createDeps();
      const pricing = makePricing({
        xpayProductId: 'jp_d30_p9000',
        xpayPropStatus: 'READY',
        xpayPublishedAt: minsAgo(20),
      });
      expect(d.service.assertPropReadyOrThrow(pricing)).toBe('jp_d30_p9000');
    });

    it('beginSync：未同步的 pricing 行写 SYNCING/UPLOAD（表闭包落库到 pricing_config）', async () => {
      const d = createDeps();
      await d.service.beginSync(makePricing());
      expect(d.prisma.pricingConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pc_1' },
          data: expect.objectContaining({
            xpayProductId: 'jp_d30_p9000',
            xpayPropStatus: 'SYNCING',
            xpaySyncStep: 'UPLOAD',
          }),
        }),
      );
    });
  });
});
