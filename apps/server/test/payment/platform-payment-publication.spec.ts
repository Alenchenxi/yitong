import {
  JobDuration,
  JobPostStatus,
  PayScene,
  PayStatus,
  PostStatus,
  PostVisibility,
  PublicationScope,
} from '@prisma/client';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { PaymentService } from '../../src/modules/payment/payment.service';

const denied = new BizException(10003, '平台发布内容仅限当前平台管理员管理');
const communityDenied = new BizException(80015, '你已被当前圈子封禁');

function createService(
  prisma: Record<string, unknown>,
  boost: Record<string, unknown>,
  options: { allowOwner?: boolean; allowInTransaction?: boolean; interactionError?: Error } = {},
) {
  const publicationPolicy = {
    assertOwnerCanManage: options.allowOwner
      ? jest.fn().mockResolvedValue(undefined)
      : jest.fn().mockRejectedValue(denied),
    assertOwnerCanManageInTransaction: options.allowInTransaction
      ? jest.fn().mockResolvedValue(undefined)
      : jest.fn().mockRejectedValue(denied),
    assertCommunityInteractionAllowed: options.interactionError
      ? jest.fn().mockRejectedValue(options.interactionError)
      : jest.fn().mockResolvedValue(undefined),
    assertCommunityInteractionAllowedInTransaction: options.interactionError
      ? jest.fn().mockRejectedValue(options.interactionError)
      : jest.fn().mockResolvedValue(undefined),
  };
  const service = new PaymentService(
    prisma as never,
    {} as never,
    {} as never,
    { create: jest.fn() } as never,
    boost as never,
    { invalidateFeedCache: jest.fn() } as never,
    publicationPolicy as never,
  );
  return { service, publicationPolicy };
}

describe('PaymentService 平台内容延迟生效资格复核', () => {
  it('平台管理员身份撤销后不能为待发布平台岗位创建订单', async () => {
    const prisma = {
      merchant: { findUnique: jest.fn().mockResolvedValue({ id: 'merchant_1' }) },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          merchantId: 'merchant_1',
          publisherScope: PublicationScope.PLATFORM,
          status: JobPostStatus.PENDING,
        }),
      },
      pricingConfig: { findUnique: jest.fn() },
      paymentOrder: { create: jest.fn() },
    };
    const { service } = createService(prisma, {});

    await expect(service.createJobPublishOrder('user_1', {
      jobPostId: 'job_1',
      duration: JobDuration.D30,
    })).rejects.toBe(denied);

    expect(prisma.pricingConfig.findUnique).not.toHaveBeenCalled();
    expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
  });

  it('已被圈子封禁的商家不能创建岗位发布订单', async () => {
    const prisma = {
      merchant: { findUnique: jest.fn().mockResolvedValue({ id: 'merchant_1' }) },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          merchantId: 'merchant_1',
          communityId: 'community_1',
          publisherScope: PublicationScope.COMMUNITY,
          status: JobPostStatus.PENDING,
        }),
      },
      pricingConfig: { findUnique: jest.fn() },
      paymentOrder: { create: jest.fn() },
    };
    const { service } = createService(prisma, {}, {
      allowOwner: true,
      interactionError: communityDenied,
    });

    await expect(service.createJobPublishOrder('user_1', {
      jobPostId: 'job_1',
      duration: JobDuration.D30,
    })).rejects.toBe(communityDenied);

    expect(prisma.pricingConfig.findUnique).not.toHaveBeenCalled();
    expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
  });

  it.each([
    ['post', 'post_1'],
    ['anon_post', 'anon_1'],
  ] as const)('已被圈子封禁的用户不能创建%s推广订单', async (targetType, targetId) => {
    const prisma = {
      post: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post_1',
          authorId: 'user_1',
          communityId: 'community_1',
          publisherScope: PublicationScope.COMMUNITY,
          status: PostStatus.APPROVED,
          visibility: PostVisibility.PUBLIC,
          deletedAt: null,
          content: '表白墙内容',
        }),
      },
      anonymousProfile: {
        findFirst: jest.fn().mockResolvedValue({ anonId: 'author_anon' }),
      },
      anonymousPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'anon_1',
          anonId: 'author_anon',
          communityId: 'community_1',
          publisherScope: PublicationScope.COMMUNITY,
          status: PostStatus.APPROVED,
          content: '树洞内容',
        }),
      },
      paymentOrder: { create: jest.fn() },
    };
    const boost = {
      getPlan: jest.fn().mockResolvedValue({ id: 'plan_1', price: 1 }),
    };
    const { service } = createService(prisma, boost, {
      allowOwner: true,
      interactionError: communityDenied,
    });

    await expect(service.createBoostOrder('user_1', {
      targetType,
      targetId,
      planCode: 'DAY_1',
    })).rejects.toBe(communityDenied);

    expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
  });

  it.each([
    ['post', 'post_1'],
    ['anon_post', 'anon_1'],
  ] as const)('平台管理员身份撤销后不能推广平台%s', async (targetType, targetId) => {
    const prisma = {
      post: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post_1',
          authorId: 'user_1',
          publisherScope: PublicationScope.PLATFORM,
          status: PostStatus.APPROVED,
          visibility: PostVisibility.PUBLIC,
          deletedAt: null,
          content: '平台表白墙',
        }),
      },
      anonymousProfile: {
        findFirst: jest.fn().mockResolvedValue({ anonId: 'author_anon' }),
      },
      anonymousPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'anon_1',
          anonId: 'author_anon',
          publisherScope: PublicationScope.PLATFORM,
          status: PostStatus.APPROVED,
          content: '平台树洞',
        }),
      },
      paymentOrder: { create: jest.fn() },
    };
    const boost = {
      getPlan: jest.fn().mockResolvedValue({ id: 'plan_1', price: 1 }),
    };
    const { service } = createService(prisma, boost);

    await expect(service.createBoostOrder('user_1', {
      targetType,
      targetId,
      planCode: 'DAY_1',
    })).rejects.toBe(denied);

    expect(prisma.paymentOrder.create).not.toHaveBeenCalled();
  });

  it('平台管理员身份在下单后撤销时不能由支付回调发布平台岗位', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'job_1', publisherScope: PublicationScope.PLATFORM, communityId: 'community_a' }]),
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      jobPost: { updateMany: jest.fn() },
    };
    const transaction = jest.fn(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene: PayScene.JOB_PUBLISH,
          status: PayStatus.PENDING,
          duration: JobDuration.D30,
          merchantId: 'merchant_1',
          jobPostId: 'job_1',
          wxTransactionId: null,
        }),
      },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({ publisherScope: PublicationScope.PLATFORM }),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user_1',
          contactPhone: '13900000000',
          contactWechat: 'wx-user-1',
        }),
      },
      $transaction: transaction,
    };
    const { service, publicationPolicy } = createService(prisma, {});

    await expect(service.fulfillOrder('order_1')).rejects.toBe(denied);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order_1', status: PayStatus.PENDING },
    }));
    expect(publicationPolicy.assertOwnerCanManageInTransaction).toHaveBeenCalledWith(
      tx,
      'user_1',
      PublicationScope.PLATFORM,
    );
    expect(tx.jobPost.updateMany).not.toHaveBeenCalled();
  });

  it('重复岗位支付回调未取得订单状态时不得再次发布岗位', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'job_1', publisherScope: PublicationScope.PLATFORM, communityId: 'community_a' }]),
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      jobPost: { updateMany: jest.fn() },
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene: PayScene.JOB_PUBLISH,
          status: PayStatus.PENDING,
          duration: JobDuration.D30,
          merchantId: 'merchant_1',
          jobPostId: 'job_1',
          wxTransactionId: null,
        }),
      },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({ publisherScope: PublicationScope.PLATFORM }),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user_1',
          contactPhone: '13900000000',
          contactWechat: 'wx-user-1',
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const { service, publicationPolicy } = createService(prisma, {});

    await expect(service.fulfillOrder('order_1')).resolves.toBeUndefined();

    expect(publicationPolicy.assertOwnerCanManageInTransaction).not.toHaveBeenCalled();
    expect(tx.jobPost.updateMany).not.toHaveBeenCalled();
  });

  it('岗位已被管理员下架时支付履约应冲突并回滚订单认领', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'job_1', publisherScope: PublicationScope.PLATFORM, communityId: 'community_a' }]),
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      jobPost: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene: PayScene.JOB_PUBLISH,
          status: PayStatus.PENDING,
          duration: JobDuration.D30,
          merchantId: 'merchant_1',
          jobPostId: 'job_1',
          wxTransactionId: null,
        }),
      },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({ publisherScope: PublicationScope.PLATFORM }),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user_1',
          contactPhone: '13900000000',
          contactWechat: 'wx-user-1',
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const { service } = createService(prisma, {}, { allowInTransaction: true });

    await expect(service.fulfillOrder('order_1')).rejects.toMatchObject({ bizCode: 40004 });
    expect(tx.jobPost.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'job_1',
        status: JobPostStatus.PENDING,
        moderationAuthority: null,
      },
    }));
  });

  it('岗位支付后商家被当前圈子封禁时不得发布', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{
        id: 'job_1',
        publisherScope: PublicationScope.COMMUNITY,
        communityId: 'community_a',
      }]),
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      jobPost: { updateMany: jest.fn() },
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene: PayScene.JOB_PUBLISH,
          status: PayStatus.PENDING,
          duration: JobDuration.D30,
          merchantId: 'merchant_1',
          jobPostId: 'job_1',
          wxTransactionId: null,
        }),
      },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({ publisherScope: PublicationScope.COMMUNITY }),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user_1',
          contactPhone: '13900000000',
          contactWechat: 'wx-user-1',
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const { service, publicationPolicy } = createService(
      prisma,
      {},
      { allowInTransaction: true, interactionError: communityDenied },
    );

    await expect(service.fulfillOrder('order_1')).rejects.toBe(communityDenied);

    expect(publicationPolicy.assertCommunityInteractionAllowedInTransaction).toHaveBeenCalledWith(
      tx,
      'user_1',
      'community_a',
    );
    expect(tx.jobPost.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    [PayScene.POST_BOOST, 'post', 'post_1'],
    [PayScene.ANON_POST_BOOST, 'anon_post', 'anon_1'],
  ] as const)('平台管理员身份在下单后撤销时不能履约%s推广', async (scene, targetType, targetId) => {
    const tx = {
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{
        publisherScope: PublicationScope.PLATFORM,
        communityId: 'community_a',
        status: PostStatus.APPROVED,
        visibility: PostVisibility.PUBLIC,
        deletedAt: null,
      }]),
    };
    const transaction = jest.fn(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene,
          status: PayStatus.PENDING,
          boostPlanId: 'plan_1',
          userId: 'user_1',
          postId: targetType === 'post' ? targetId : null,
          anonPostId: targetType === 'anon_post' ? targetId : null,
        }),
      },
      boostPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan_1', durationHours: 24 }),
      },
      post: {
        findUnique: jest.fn().mockResolvedValue({
          publisherScope: PublicationScope.PLATFORM,
          boostUntil: null,
        }),
      },
      anonymousPost: {
        findUnique: jest.fn().mockResolvedValue({
          publisherScope: PublicationScope.PLATFORM,
          boostUntil: null,
        }),
      },
      $transaction: transaction,
    };
    const boost = { applyBoost: jest.fn() };
    const { service, publicationPolicy } = createService(prisma, boost);

    await expect(service.fulfillOrder('order_1')).rejects.toBe(denied);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(publicationPolicy.assertOwnerCanManageInTransaction).toHaveBeenCalledWith(
      tx,
      'user_1',
      PublicationScope.PLATFORM,
    );
    expect(boost.applyBoost).not.toHaveBeenCalled();
  });

  it('推广支付后发布者被当前圈子封禁时不得生效', async () => {
    const tx = {
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{
        publisherScope: PublicationScope.COMMUNITY,
        communityId: 'community_a',
        status: PostStatus.APPROVED,
        visibility: PostVisibility.PUBLIC,
        deletedAt: null,
      }]),
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene: PayScene.POST_BOOST,
          status: PayStatus.PENDING,
          boostPlanId: 'plan_1',
          userId: 'user_1',
          postId: 'post_1',
          anonPostId: null,
        }),
      },
      boostPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan_1', durationHours: 24 }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const boost = { applyBoost: jest.fn() };
    const { service, publicationPolicy } = createService(
      prisma,
      boost,
      { allowInTransaction: true, interactionError: communityDenied },
    );

    await expect(service.fulfillOrder('order_1')).rejects.toBe(communityDenied);

    expect(publicationPolicy.assertCommunityInteractionAllowedInTransaction).toHaveBeenCalledWith(
      tx,
      'user_1',
      'community_a',
    );
    expect(boost.applyBoost).not.toHaveBeenCalled();
  });

  it.each([
    [
      PayScene.POST_BOOST,
      'post',
      'post_1',
      {
        publisherScope: PublicationScope.COMMUNITY,
        communityId: 'community_a',
        status: PostStatus.REJECTED,
        visibility: PostVisibility.PUBLIC,
        deletedAt: null,
      },
      'FROM "posts"',
    ],
    [
      PayScene.ANON_POST_BOOST,
      'anon_post',
      'anon_1',
      {
        publisherScope: PublicationScope.COMMUNITY,
        communityId: 'community_a',
        status: PostStatus.REJECTED,
      },
      'FROM "anonymous_posts"',
    ],
  ] as const)(
    '推广目标在下单后被管理员下架时不得履约%s',
    async (scene, targetType, targetId, lockedRow, expectedTable) => {
      const tx = {
        paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        $queryRawUnsafe: jest.fn().mockResolvedValue([lockedRow]),
      };
      const prisma = {
        paymentOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order_1',
            scene,
            status: PayStatus.PENDING,
            boostPlanId: 'plan_1',
            userId: 'user_1',
            postId: targetType === 'post' ? targetId : null,
            anonPostId: targetType === 'anon_post' ? targetId : null,
          }),
        },
        boostPlan: {
          findUnique: jest.fn().mockResolvedValue({ id: 'plan_1', durationHours: 24 }),
        },
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      };
      const boost = { applyBoost: jest.fn() };
      const { service, publicationPolicy } = createService(prisma, boost);

      await expect(service.fulfillOrder('order_1')).rejects.toMatchObject({ bizCode: 50007 });

      expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining(expectedTable),
        targetId,
      );
      expect(tx.$queryRawUnsafe.mock.calls[0]?.[0]).toContain('FOR UPDATE');
      expect(publicationPolicy.assertOwnerCanManageInTransaction).not.toHaveBeenCalled();
      expect(boost.applyBoost).not.toHaveBeenCalled();
    },
  );

  it('同步微信关闭状态时不得覆盖并发支付成功终态', async () => {
    const pendingOrder = {
      id: 'order_sync_race',
      scene: PayScene.POST_BOOST,
      duration: null,
      jobPostId: null,
      postId: 'post_1',
      anonPostId: null,
      boostPlanId: 'plan_1',
      merchantId: null,
      userId: 'user_1',
      amount: { toString: () => '1.00' },
      status: PayStatus.PENDING,
      paidAt: null,
      refundedAt: null,
      refundReason: null,
      wxTransactionId: null,
      wxRefundId: null,
      refundStatus: null,
      createdAt: new Date('2026-09-04T09:00:00.000Z'),
    };
    const paidOrder = {
      ...pendingOrder,
      status: PayStatus.PAID,
      paidAt: new Date('2026-09-04T10:00:00.000Z'),
      wxTransactionId: 'transaction_1',
    };
    const paymentOrder = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce(paidOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      {} as never,
      {
        isReady: jest.fn().mockReturnValue(true),
        queryOrder: jest.fn().mockResolvedValue({ tradeState: 'CLOSED' }),
      } as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.syncOrderStatus('user_1', pendingOrder.id);

    expect(paymentOrder.updateMany).toHaveBeenCalledWith({
      where: { id: pendingOrder.id, status: PayStatus.PENDING },
      data: { status: PayStatus.CLOSED },
    });
    expect(result.status).toBe(PayStatus.PAID);
    expect(result.message).toBe('订单状态已由其他流程更新');
  });

  it('生产支付成功但资格失效时应落账并自动进入退款中后 ACK', async () => {
    const pendingOrder = { status: PayStatus.PENDING, refundStatus: null };
    const refundRequiredOrder = {
      id: 'order_notify_refund',
      amount: { toString: () => '1.00' },
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：你已被当前圈子封禁',
      refundAttempt: 1,
    };
    const paymentOrder = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce(refundRequiredOrder),
      updateMany: jest.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      verifyAndParseCallback: jest.fn().mockReturnValue({
        out_trade_no: refundRequiredOrder.id,
        transaction_id: 'transaction_notify_refund',
        trade_state: 'SUCCESS',
      }),
      refund: jest.fn().mockResolvedValue({ refundId: 'refund_1', status: 'PROCESSING' }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'fulfillOrder').mockRejectedValue(communityDenied);

    await expect(service.notify('{}', {})).resolves.toEqual({
      code: 'SUCCESS',
      message: 'payment refund refunding',
    });

    expect(paymentOrder.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { id: refundRequiredOrder.id, status: PayStatus.PENDING },
      data: expect.objectContaining({
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundAttempt: 1,
        refundRetryAt: expect.any(Date),
        wxTransactionId: 'transaction_notify_refund',
      }),
    }));
    expect(wxPay.refund).toHaveBeenCalledWith(expect.objectContaining({
      outTradeNo: refundRequiredOrder.id,
      outRefundNo: `${refundRequiredOrder.id}_R1`,
      amountInFen: 100,
    }));
    expect(paymentOrder.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        id: refundRequiredOrder.id,
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundAttempt: 1,
      },
      data: expect.objectContaining({ status: PayStatus.REFUNDING, refundStatus: 'PROCESSING' }),
    }));
  });

  it('主动查单发现已支付但资格失效时应落账并自动退款', async () => {
    const baseOrder = {
      id: 'order_sync_refund',
      scene: PayScene.POST_BOOST,
      duration: null,
      jobPostId: null,
      postId: 'post_1',
      anonPostId: null,
      boostPlanId: 'plan_1',
      merchantId: null,
      userId: 'user_1',
      amount: { toString: () => '1.00' },
      paidAt: null,
      refundedAt: null,
      refundReason: null,
      wxTransactionId: null,
      wxRefundId: null,
      refundStatus: null,
      createdAt: new Date('2026-09-04T09:00:00.000Z'),
    };
    const pendingOrder = { ...baseOrder, status: PayStatus.PENDING };
    const refundRequiredOrder = {
      ...baseOrder,
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：你已被当前圈子封禁',
      refundAttempt: 1,
      wxTransactionId: 'transaction_sync_refund',
    };
    const refundingOrder = {
      ...refundRequiredOrder,
      status: PayStatus.REFUNDING,
      refundStatus: 'PROCESSING',
      wxRefundId: 'refund_2',
    };
    const paymentOrder = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce(refundRequiredOrder)
        .mockResolvedValueOnce(refundingOrder),
      updateMany: jest.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      queryOrder: jest.fn().mockResolvedValue({
        transactionId: 'transaction_sync_refund',
        tradeState: 'SUCCESS',
      }),
      refund: jest.fn().mockResolvedValue({ refundId: 'refund_2', status: 'PROCESSING' }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'fulfillOrder').mockRejectedValue(communityDenied);

    const result = await service.syncOrderStatus('user_1', pendingOrder.id);

    expect(result.status).toBe(PayStatus.REFUNDING);
    expect(result.refundStatus).toBe('PROCESSING');
    expect(result.message).toBe('微信已确认支付，但履约失败，订单待退款');
    expect(wxPay.refund).toHaveBeenCalledTimes(1);
  });

  it('定时补偿应持续消费 PAID + REQUIRED 自动退款队列', async () => {
    const requiredOrder = {
      id: 'order_retry_refund',
      amount: { toString: () => '2.00' },
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：账号已被封禁',
      refundAttempt: 1,
    };
    const paymentOrder = {
      findMany: jest.fn().mockResolvedValue([{ id: requiredOrder.id }]),
      findUnique: jest.fn().mockResolvedValue(requiredOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      refund: jest.fn().mockResolvedValue({ refundId: 'refund_retry', status: 'SUCCESS' }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.retryRequiredFulfillmentRefunds();

    expect(paymentOrder.findMany).toHaveBeenCalledWith({
      where: {
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundRetryAt: { lte: expect.any(Date) },
      },
      orderBy: [{ refundRetryAt: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true },
    });
    expect(wxPay.refund).toHaveBeenCalledWith(expect.objectContaining({
      outTradeNo: requiredOrder.id,
      outRefundNo: `${requiredOrder.id}_R1`,
      amountInFen: 200,
    }));
    expect(paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: requiredOrder.id, status: PayStatus.PAID, refundStatus: 'REQUIRED' },
      data: expect.objectContaining({ status: PayStatus.REFUNDED, refundStatus: 'SUCCESS' }),
    }));
  });

  it('失败批次推进重试时间后应让第 21 条待退款订单进入下一批', async () => {
    const queue: Array<{
      id: string;
      amount: { toString: () => string };
      status: PayStatus;
      refundStatus: string;
      refundReason: string;
      refundAttempt: number;
      refundRetryAt: Date;
      createdAt: Date;
    }> = Array.from({ length: 21 }, (_, index) => ({
      id: `order_fair_${index + 1}`,
      amount: { toString: () => '1.00' },
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：账号已被封禁',
      refundAttempt: 1,
      refundRetryAt: new Date(0),
      createdAt: new Date(index),
    }));
    const paymentOrder = {
      findMany: jest.fn().mockImplementation((args: {
        where: { refundRetryAt: { lte: Date } };
        take: number;
      }) => Promise.resolve(
        queue
          .filter((order) => (
            order.status === PayStatus.PAID
            && order.refundStatus === 'REQUIRED'
            && order.refundRetryAt <= args.where.refundRetryAt.lte
          ))
          .sort((left, right) => (
            left.refundRetryAt.getTime() - right.refundRetryAt.getTime()
            || left.createdAt.getTime() - right.createdAt.getTime()
          ))
          .slice(0, args.take)
          .map(({ id }) => ({ id })),
      )),
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => (
        Promise.resolve(queue.find((order) => order.id === args.where.id))
      )),
      updateMany: jest.fn().mockImplementation((args: {
        where: { id: string; status: PayStatus; refundStatus: string; refundAttempt?: number };
        data: {
          status?: PayStatus;
          refundStatus?: string;
          refundRetryAt?: Date;
          refundAttempt?: { increment: number };
        };
      }) => {
        const order = queue.find((item) => item.id === args.where.id);
        if (
          !order
          || order.status !== args.where.status
          || order.refundStatus !== args.where.refundStatus
          || (
            args.where.refundAttempt !== undefined
            && order.refundAttempt !== args.where.refundAttempt
          )
        ) {
          return Promise.resolve({ count: 0 });
        }
        if (args.data.status) order.status = args.data.status;
        if (args.data.refundStatus) order.refundStatus = args.data.refundStatus;
        if (args.data.refundRetryAt) order.refundRetryAt = args.data.refundRetryAt;
        if (args.data.refundAttempt) order.refundAttempt += args.data.refundAttempt.increment;
        return Promise.resolve({ count: 1 });
      }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      refund: jest.fn().mockImplementation((input: { outTradeNo: string }) => (
        Promise.resolve(input.outTradeNo === 'order_fair_21'
          ? { refundId: 'refund_fair_21', status: 'SUCCESS' }
          : { refundId: `refund_${input.outTradeNo}`, status: 'ABNORMAL' })
      )),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.retryRequiredFulfillmentRefunds();
    await service.retryRequiredFulfillmentRefunds();

    expect(wxPay.refund).toHaveBeenCalledTimes(21);
    expect(wxPay.refund.mock.calls.slice(0, 20).map(([input]) => input.outTradeNo))
      .toEqual(queue.slice(0, 20).map(({ id }) => id));
    expect(wxPay.refund).toHaveBeenNthCalledWith(21, expect.objectContaining({
      outTradeNo: 'order_fair_21',
    }));
    expect(queue.slice(0, 20).every((order) => order.refundRetryAt.getTime() > Date.now()))
      .toBe(true);
  });
  it('待自动退款订单通过主动退款入口时仍使用自动退款队列语义', async () => {
    const requiredOrder = {
      id: 'order_required_manual',
      scene: PayScene.POST_BOOST,
      duration: null,
      jobPostId: null,
      postId: 'post_1',
      anonPostId: null,
      boostPlanId: 'plan_1',
      merchantId: null,
      userId: 'user_1',
      amount: { toString: () => '1.00' },
      status: PayStatus.PAID,
      paidAt: new Date('2026-09-04T10:00:00.000Z'),
      refundedAt: null,
      refundReason: '支付成功但履约失败：账号已被封禁',
      wxTransactionId: 'transaction_required_manual',
      wxRefundId: null,
      refundStatus: 'REQUIRED',
      fulfillmentApplied: false,
      refundAttempt: 1,
      createdAt: new Date('2026-09-04T09:00:00.000Z'),
    };
    const refundedOrder = {
      ...requiredOrder,
      status: PayStatus.REFUNDED,
      refundedAt: new Date('2026-09-04T10:01:00.000Z'),
      refundStatus: 'SUCCESS',
      wxRefundId: 'refund_required_manual',
    };
    const paymentOrder = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(requiredOrder)
        .mockResolvedValueOnce(requiredOrder)
        .mockResolvedValueOnce(refundedOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      refund: jest.fn().mockResolvedValue({
        refundId: 'refund_required_manual',
        status: 'SUCCESS',
      }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.refundOrder('user_1', requiredOrder.id, '用户申请退款');

    expect(wxPay.refund).toHaveBeenCalledWith(expect.objectContaining({
      outTradeNo: requiredOrder.id,
      outRefundNo: `${requiredOrder.id}_R1`,
      reason: requiredOrder.refundReason,
    }));
    expect(paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: requiredOrder.id, status: PayStatus.PAID, refundStatus: 'REQUIRED' },
    }));
    expect(result.status).toBe(PayStatus.REFUNDED);
    expect(result.refundStatus).toBe('SUCCESS');
  });

  it('自动退款明确关闭后应递增重试序号并用新退款单号重试', async () => {
    const firstAttempt = {
      id: 'order_retry_closed',
      amount: { toString: () => '2.00' },
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：账号已被封禁',
      refundAttempt: 1,
    };
    const secondAttempt = { ...firstAttempt, refundAttempt: 2 };
    const paymentOrder = {
      findMany: jest.fn().mockResolvedValue([{ id: firstAttempt.id }]),
      findUnique: jest.fn()
        .mockResolvedValueOnce(firstAttempt)
        .mockResolvedValueOnce(secondAttempt),
      updateMany: jest.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      refund: jest.fn()
        .mockResolvedValueOnce({ refundId: 'refund_closed', status: 'CLOSED' })
        .mockResolvedValueOnce({ refundId: 'refund_retry_2', status: 'SUCCESS' }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.retryRequiredFulfillmentRefunds();
    await service.retryRequiredFulfillmentRefunds();

    expect(wxPay.refund).toHaveBeenNthCalledWith(1, expect.objectContaining({
      outRefundNo: `${firstAttempt.id}_R1`,
    }));
    expect(paymentOrder.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        id: firstAttempt.id,
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundAttempt: 1,
      },
      data: expect.objectContaining({
        refundAttempt: { increment: 1 },
        refundRetryAt: expect.any(Date),
      }),
    }));
    expect(wxPay.refund).toHaveBeenNthCalledWith(2, expect.objectContaining({
      outRefundNo: `${firstAttempt.id}_R2`,
    }));
  });

  it('旧 attempt 延迟返回 PROCESSING 时不得覆盖已推进的新 attempt', async () => {
    let state: {
      id: string;
      amount: { toString: () => string };
      status: PayStatus;
      refundStatus: string;
      refundReason: string;
      refundAttempt: number;
    } = {
      id: 'order_processing_race',
      amount: { toString: () => '1.00' },
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：账号已被封禁',
      refundAttempt: 1,
    };
    let resolveFirstRefund!: (value: { refundId: string; status: string }) => void;
    let markFirstRefundStarted!: () => void;
    const firstRefundStarted = new Promise<void>((resolve) => {
      markFirstRefundStarted = resolve;
    });
    const firstRefundResponse = new Promise<{ refundId: string; status: string }>((resolve) => {
      resolveFirstRefund = resolve;
    });
    const paymentOrder = {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      updateMany: jest.fn().mockImplementation((args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (
          args.where.status !== state.status
          || args.where.refundStatus !== state.refundStatus
          || (
            typeof args.where.refundAttempt === 'number'
            && args.where.refundAttempt !== state.refundAttempt
          )
        ) {
          return Promise.resolve({ count: 0 });
        }
        const increment = args.data.refundAttempt as { increment?: number } | undefined;
        state = {
          ...state,
          status: (args.data.status as PayStatus | undefined) ?? state.status,
          refundStatus: (args.data.refundStatus as string | undefined) ?? state.refundStatus,
          refundReason: (args.data.refundReason as string | undefined) ?? state.refundReason,
          refundAttempt: state.refundAttempt + (increment?.increment ?? 0),
        };
        return Promise.resolve({ count: 1 });
      }),
    };
    const wxPay = {
      refund: jest.fn()
        .mockImplementationOnce(() => {
          markFirstRefundStarted();
          return firstRefundResponse;
        })
        .mockResolvedValueOnce({ refundId: 'refund_closed_r1', status: 'CLOSED' }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const retry = (
      service as unknown as {
        retryRequiredFulfillmentRefund(orderId: string): Promise<PayStatus | null>;
      }
    ).retryRequiredFulfillmentRefund.bind(service);

    const delayedProcessing = retry(state.id);
    await firstRefundStarted;
    await expect(retry(state.id)).rejects.toThrow('automatic refund closed');
    resolveFirstRefund({ refundId: 'refund_processing_r1', status: 'PROCESSING' });
    await expect(delayedProcessing).resolves.toBe(PayStatus.PAID);

    expect(state).toMatchObject({
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundAttempt: 2,
    });
    expect(paymentOrder.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        id: state.id,
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundAttempt: 1,
      },
      data: expect.objectContaining({
        status: PayStatus.REFUNDING,
        refundStatus: 'PROCESSING',
      }),
    }));
  });
  it('自动退款网络异常时应保持同一退款单号以保证幂等', async () => {
    const requiredOrder = {
      id: 'order_retry_network',
      amount: { toString: () => '3.00' },
      status: PayStatus.PAID,
      refundStatus: 'REQUIRED',
      refundReason: '支付成功但履约失败：账号已被封禁',
      refundAttempt: 1,
    };
    const paymentOrder = {
      findMany: jest.fn().mockResolvedValue([{ id: requiredOrder.id }]),
      findUnique: jest.fn().mockResolvedValue(requiredOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      refund: jest.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({ refundId: 'refund_retry_network', status: 'SUCCESS' }),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.retryRequiredFulfillmentRefunds();
    await service.retryRequiredFulfillmentRefunds();

    expect(wxPay.refund).toHaveBeenNthCalledWith(1, expect.objectContaining({
      outRefundNo: `${requiredOrder.id}_R1`,
    }));
    expect(wxPay.refund).toHaveBeenNthCalledWith(2, expect.objectContaining({
      outRefundNo: `${requiredOrder.id}_R1`,
    }));
    expect(paymentOrder.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: requiredOrder.id,
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundAttempt: 1,
      },
      data: { refundRetryAt: expect.any(Date) },
    });
    expect(paymentOrder.updateMany).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['CLOSED', 2, 'R2'],
    ['ABNORMAL', 1, 'R1'],
  ] as const)(
    '未履约自动退款 PROCESSING 后收到当前 attempt 的 %s 回调应重新入队',
    async (callbackStatus, nextAttempt, nextSuffix) => {
      const processingOrder = {
        id: `order_callback_${callbackStatus.toLowerCase()}`,
        amount: { toString: () => '1.00' },
        status: PayStatus.REFUNDING,
        refundStatus: 'PROCESSING',
        refundReason: '支付成功但履约失败：账号已被封禁',
        refundAttempt: 1,
        fulfillmentApplied: false,
      };
      const requiredOrder = {
        ...processingOrder,
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundAttempt: nextAttempt,
      };
      const paymentOrder = {
        findUnique: jest.fn()
          .mockResolvedValueOnce(processingOrder)
          .mockResolvedValueOnce(requiredOrder),
        findMany: jest.fn().mockResolvedValue([{ id: processingOrder.id }]),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      };
      const wxPay = {
        isReady: jest.fn().mockReturnValue(true),
        verifyAndParseRefundCallback: jest.fn().mockReturnValue({
          out_trade_no: processingOrder.id,
          out_refund_no: `${processingOrder.id}_R1`,
          refund_status: callbackStatus,
          refund_id: 'refund_callback_1',
        }),
        refund: jest.fn().mockResolvedValue({
          refundId: 'refund_callback_retry',
          status: 'SUCCESS',
        }),
      };
      const service = new PaymentService(
        { paymentOrder } as never,
        { get: jest.fn().mockReturnValue(undefined) } as never,
        wxPay as never,
        { create: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
      );

      await expect(service.refundNotify('{}', {})).resolves.toEqual({
        code: 'SUCCESS',
        message: 'OK',
      });
      await service.retryRequiredFulfillmentRefunds();

      expect(paymentOrder.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: {
          id: processingOrder.id,
          status: PayStatus.REFUNDING,
          fulfillmentApplied: false,
          refundAttempt: 1,
        },
        data: expect.objectContaining({
          status: PayStatus.PAID,
          refundStatus: 'REQUIRED',
          refundRetryAt: expect.any(Date),
          ...(callbackStatus === 'CLOSED' ? { refundAttempt: { increment: 1 } } : {}),
        }),
      }));
      expect(wxPay.refund).toHaveBeenCalledWith(expect.objectContaining({
        outRefundNo: `${processingOrder.id}_${nextSuffix}`,
      }));
    },
  );

  it('旧 attempt 的失败回调不得覆盖正在处理的新自动退款', async () => {
    const processingOrder = {
      id: 'order_stale_callback',
      status: PayStatus.REFUNDING,
      refundStatus: 'PROCESSING',
      refundReason: '支付成功但履约失败：账号已被封禁',
      refundAttempt: 2,
      fulfillmentApplied: false,
    };
    const paymentOrder = {
      findUnique: jest.fn().mockResolvedValue(processingOrder),
      updateMany: jest.fn(),
    };
    const service = new PaymentService(
      { paymentOrder } as never,
      {} as never,
      {
        isReady: jest.fn().mockReturnValue(true),
        verifyAndParseRefundCallback: jest.fn().mockReturnValue({
          out_trade_no: processingOrder.id,
          out_refund_no: `${processingOrder.id}_R1`,
          refund_status: 'CLOSED',
          refund_id: 'refund_stale_1',
        }),
      } as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.refundNotify('{}', {})).resolves.toEqual({
      code: 'SUCCESS',
      message: 'ignored: stale refund attempt',
    });
    expect(paymentOrder.updateMany).not.toHaveBeenCalled();
  });
  it('生产环境退款回调配置不可用时应返回 FAIL 让微信重试', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = new PaymentService(
      {} as never,
      {} as never,
      { isReady: jest.fn().mockReturnValue(false) } as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    try {
      await expect(service.refundNotify('{}', {})).resolves.toEqual({
        code: 'FAIL',
        message: '微信退款回调未接入',
      });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('岗位退款回调应按岗位到订单顺序加锁并以订单状态 CAS 控制副作用', async () => {
    const events: string[] = [];
    const order = {
      id: 'order_refund',
      scene: PayScene.JOB_PUBLISH,
      status: PayStatus.PAID,
      jobPostId: 'job_1',
      fulfillmentApplied: true,
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockImplementation(() => {
        events.push('job');
        return Promise.resolve([{ id: 'job_1' }]);
      }),
      paymentOrder: {
        updateMany: jest.fn().mockImplementation(() => {
          events.push('order');
          return Promise.resolve({ count: 1 });
        }),
      },
      jobPost: {
        updateMany: jest.fn().mockImplementation(() => {
          events.push('side-effect');
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    const prisma = {
      paymentOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const wxPay = {
      isReady: jest.fn().mockReturnValue(true),
      verifyAndParseRefundCallback: jest.fn().mockReturnValue({
        out_trade_no: order.id,
        refund_status: 'SUCCESS',
        refund_id: 'refund_1',
      }),
    };
    const service = new PaymentService(
      prisma as never,
      {} as never,
      wxPay as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.refundNotify('{}', {})).resolves.toEqual({
      code: 'SUCCESS',
      message: 'OK',
    });

    expect(events).toEqual(['job', 'order', 'side-effect']);
    expect(tx.paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: order.id,
        status: { in: [PayStatus.PAID, PayStatus.REFUNDING] },
      },
    }));
  });

  it('未履约自动退款回调成功时不得撤销其他有效推广', async () => {
    const order = {
      id: 'order_failed_boost_refund',
      scene: PayScene.POST_BOOST,
      status: PayStatus.REFUNDING,
      postId: 'post_1',
      anonPostId: null,
      fulfillmentApplied: false,
    };
    const tx = {
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      paymentOrder: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const boost = { applyBoostRefund: jest.fn() };
    const service = new PaymentService(
      prisma as never,
      {} as never,
      {
        isReady: jest.fn().mockReturnValue(true),
        verifyAndParseRefundCallback: jest.fn().mockReturnValue({
          out_trade_no: order.id,
          refund_status: 'SUCCESS',
          refund_id: 'refund_failed_boost',
        }),
      } as never,
      { create: jest.fn() } as never,
      boost as never,
      { invalidateFeedCache: jest.fn() } as never,
      {} as never,
    );

    await expect(service.refundNotify('{}', {})).resolves.toEqual({
      code: 'SUCCESS',
      message: 'OK',
    });

    expect(tx.paymentOrder.updateMany).toHaveBeenCalled();
    expect(boost.applyBoostRefund).not.toHaveBeenCalled();
  });

  it.each(['SUCCESS', 'PROCESSING', 'ABNORMAL'] as const)(
    '退款接口返回 %s 时不得覆盖已由成功回调写入的终态',
    async (refundResponseStatus) => {
      const paidOrder = {
        id: 'order_refund_race',
        scene: PayScene.POST_BOOST,
        duration: null,
        jobPostId: null,
        postId: 'post_1',
        anonPostId: null,
        boostPlanId: 'plan_1',
        merchantId: null,
        userId: 'user_1',
        amount: { toString: () => '1.00' },
        status: PayStatus.PAID,
        paidAt: new Date('2026-09-04T10:00:00.000Z'),
        refundedAt: null,
        refundReason: null,
        wxTransactionId: 'transaction_1',
        wxRefundId: null,
        refundStatus: null,
        createdAt: new Date('2026-09-04T09:00:00.000Z'),
      };
      const refundedOrder = {
        ...paidOrder,
        status: PayStatus.REFUNDED,
        refundedAt: new Date('2026-09-04T10:01:00.000Z'),
        refundReason: '申请退款',
        wxRefundId: 'callback_refund',
        refundStatus: 'SUCCESS',
      };
      const paymentOrder = {
        findUnique: jest.fn()
          .mockResolvedValueOnce(paidOrder)
          .mockResolvedValueOnce(refundedOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      const prisma = {
        paymentOrder,
        $transaction: jest.fn((callback: (client: { paymentOrder: typeof paymentOrder }) => unknown) =>
          callback({ paymentOrder }),
        ),
      };
      const wxPay = {
        isReady: jest.fn().mockReturnValue(true),
        refund: jest.fn().mockResolvedValue({
          refundId: 'request_refund',
          status: refundResponseStatus,
        }),
      };
      const service = new PaymentService(
        prisma as never,
        { get: jest.fn().mockReturnValue(undefined) } as never,
        wxPay as never,
        { create: jest.fn() } as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await service.refundOrder('user_1', paidOrder.id);

      expect(paymentOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: paidOrder.id, status: PayStatus.PAID },
      }));
      expect(paymentOrder.findUnique).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(PayStatus.REFUNDED);
      expect(result.refundStatus).toBe('SUCCESS');
      expect(result.wxRefundId).toBe('callback_refund');
    },
  );

  it('重复推广回调未取得订单状态时不得重复延长推广', async () => {
    const tx = {
      paymentOrder: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order_1',
          scene: PayScene.POST_BOOST,
          status: PayStatus.PENDING,
          boostPlanId: 'plan_1',
          userId: 'user_1',
          postId: 'post_1',
          anonPostId: null,
        }),
      },
      boostPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan_1', durationHours: 24 }),
      },
      post: {
        findUnique: jest.fn().mockResolvedValue({
          publisherScope: PublicationScope.PLATFORM,
          boostUntil: null,
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const boost = { applyBoost: jest.fn() };
    const { service, publicationPolicy } = createService(prisma, boost);

    await expect(service.fulfillOrder('order_1')).resolves.toBeUndefined();

    expect(publicationPolicy.assertOwnerCanManageInTransaction).not.toHaveBeenCalled();
    expect(boost.applyBoost).not.toHaveBeenCalled();
  });
});