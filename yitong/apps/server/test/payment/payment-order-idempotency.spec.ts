import { PayScene, PayStatus, PostStatus, PostVisibility, PublicationScope } from '@prisma/client';
import { PaymentService } from '../../src/modules/payment/payment.service';

describe('PaymentService 待支付订单幂等', () => {
  it('推广重试应复用同一待支付订单', async () => {
    const pendingOrder = {
      id: 'order_existing',
      scene: PayScene.POST_BOOST,
      status: PayStatus.PENDING,
      amount: { toString: () => '10.00' },
      wxPrepayId: null,
    };
    const paymentOrder = {
      findFirst: jest.fn().mockResolvedValue(pendingOrder),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
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
          content: '推广内容',
        }),
      },
      paymentOrder,
      user: { findUnique: jest.fn().mockResolvedValue({ openid: 'openid_1', sessionKey: 'session_1' }) },
    };
    const publication = {
      assertOwnerCanManage: jest.fn().mockResolvedValue(undefined),
      assertCommunityInteractionAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const wxXPay = {
      isReady: jest.fn().mockReturnValue(true),
      buildGoodsPayParams: jest.fn().mockReturnValue({ signData: 'signed', paySig: 'sig', signature: 'signature', mode: 'goods' }),
    };
    const service = new PaymentService(
      prisma as never,
      {} as never,
      { isReady: jest.fn().mockReturnValue(false) } as never,
      wxXPay as never,
      { assertBoostPropReadyOrThrow: jest.fn().mockReturnValue('boost_prop') } as never,
      { create: jest.fn() } as never,
      { getPlan: jest.fn().mockResolvedValue({ id: 'plan_1', price: 10, durationHours: 24 }) } as never,
      { invalidateFeedCache: jest.fn() } as never,
      publication as never,
    );

    const result = await service.createBoostOrder('user_1', {
      targetType: 'post',
      targetId: 'post_1',
      planCode: 'DAY_1',
    });

    expect(result.orderId).toBe('order_existing');
    expect(paymentOrder.create).not.toHaveBeenCalled();
    expect(wxXPay.buildGoodsPayParams).toHaveBeenCalledWith(expect.objectContaining({ outTradeNo: 'order_existing' }));
  });
});
