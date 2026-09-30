import { MerchantStatus, Role } from '@prisma/client';
import {
  AppConfigService,
  MERCHANT_REVIEW_ENABLED_KEY,
} from '../../src/modules/app-config/app-config.service';
import { AdminService } from '../../src/modules/admin/admin.service';
import { MerchantService } from '../../src/modules/merchant/merchant.service';

const createdAt = new Date('2026-09-07T00:00:00.000Z');
const registerDto = {
  shopName: '测试商家',
  licenseNo: 'LICENSE-001',
  contactPhone: '13800138000',
};

function buildMerchantService(initialStatus: MerchantStatus | null, needReview: boolean) {
  let merchant = initialStatus
    ? {
        id: 'merchant-1',
        userId: 'user-1',
        ...registerDto,
        status: initialStatus,
        createdAt,
      }
    : null;
  const prisma = {
    merchant: {
      findUnique: jest.fn(async () => merchant),
      create: jest.fn(async ({ data }: { data: typeof registerDto & { userId: string; status: MerchantStatus } }) => {
        merchant = { id: 'merchant-1', createdAt, ...data };
        return merchant;
      }),
      update: jest.fn(async ({ data }: { data: Partial<NonNullable<typeof merchant>> }) => {
        merchant = { ...merchant!, ...data };
        return merchant;
      }),
    },
    moderationRecord: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    userRole: {
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => create),
    },
  };
  const appConfig = { isMerchantReviewEnabled: jest.fn().mockResolvedValue(needReview) };
  const service = new MerchantService(prisma as never, {} as never, appConfig as never);
  return { service, prisma, appConfig };
}

describe('商家入驻审核平台开关', () => {
  it('旧数据库没有配置时默认需要审核', async () => {
    const prisma = { appConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new AppConfigService(prisma as never);

    await expect(service.isMerchantReviewEnabled()).resolves.toBe(true);
  });

  it('只有显式 false 才关闭商家审核，非法旧值仍安全地要求审核', async () => {
    const prisma = { appConfig: { findUnique: jest.fn().mockResolvedValue({ value: 'false' }) } };
    const service = new AppConfigService(prisma as never);

    await expect(service.isMerchantReviewEnabled()).resolves.toBe(true);
  });

  it('管理端设置列表默认开启商家审核，并允许保存布尔值', async () => {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(admin.getSettings()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: MERCHANT_REVIEW_ENABLED_KEY, value: true }),
      ]),
    );
    await admin.updateSetting(MERCHANT_REVIEW_ENABLED_KEY, false, 'admin-openid');
    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: MERCHANT_REVIEW_ENABLED_KEY },
        create: expect.objectContaining({ value: false, updatedBy: 'admin-openid' }),
      }),
    );
  });

  it('开启审核时首次注册进入 PENDING，不授予商家角色', async () => {
    const { service, prisma } = buildMerchantService(null, true);

    await expect(service.register('user-1', registerDto)).resolves.toMatchObject({
      status: MerchantStatus.PENDING,
    });
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });

  it('关闭审核时首次注册直接 APPROVED，并授予商家角色', async () => {
    const { service, prisma } = buildMerchantService(null, false);

    await expect(service.register('user-1', registerDto)).resolves.toMatchObject({
      status: MerchantStatus.APPROVED,
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledWith({
      where: { userId_role: { userId: 'user-1', role: Role.MERCHANT } },
      update: {},
      create: { userId: 'user-1', role: Role.MERCHANT },
    });
  });

  it('开启审核时二次注册回到 PENDING', async () => {
    const { service, prisma } = buildMerchantService(MerchantStatus.REJECTED, true);

    await expect(service.reapply('user-1', registerDto)).resolves.toMatchObject({
      status: MerchantStatus.PENDING,
    });
    expect(prisma.moderationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'PENDING', reason: '商家重新提交审核' }),
    });
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });

  it('关闭审核时二次注册直接 APPROVED，并恢复商家角色', async () => {
    const { service, prisma } = buildMerchantService(MerchantStatus.REJECTED, false);

    await expect(service.reapply('user-1', registerDto)).resolves.toMatchObject({
      status: MerchantStatus.APPROVED,
    });
    expect(prisma.moderationRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'APPROVED',
        reason: '商家重新提交，审核开关关闭自动通过',
      }),
    });
    expect(prisma.userRole.upsert).toHaveBeenCalledTimes(1);
  });

  it('未审核通过商家不能访问运营业务接口', async () => {
    const { service } = buildMerchantService(MerchantStatus.PENDING, true);
    const calls = [
      () => service.getMerchantReviews('user-1'),
      () => service.listCandidates('user-1', {}),
      () => service.listViewers('user-1', {}),
      () => service.markContacted('user-1', 'application-1', { contacted: true }),
      () => service.markFit('user-1', 'application-1', { fitMark: 'FIT' }),
      () => service.batchMark('user-1', { ids: ['application-1'], mark: 'contacted', contacted: true }),
      () => service.getMerchantOrders('user-1'),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({ bizCode: 60003 });
    }
  });
});
