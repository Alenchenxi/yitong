import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobDuration,
  JobPostStatus,
  PayStatus,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { WxPayService } from '../../common/wx/wx-pay.service';
import type { PublishJobDto } from './dto/payment.dto';

// 错误码 5xxxx 支付段（API §3）：50001 订单不存在 / 50002 订单已完成或无效 / 50003 金额不匹配 / 50004 单价未配置 / 50005 退款不可用
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wxPay: WxPayService,
  ) {}

  // 付费发布：按 PricingConfig 计价下单。金额服务端算，不信前端。
  // - 凭证齐全（isReady）：真实 JSAPI 下单，返回 wxPayParams 供前端 wx.requestPayment；订单留 PENDING，等回调置 PUBLISHED。
  // - 凭证缺失 + dev：mock 支付自动完成（置 PUBLISHED）。
  // - 凭证缺失 + prod：抛 90003。
  async createJobPublishOrder(merchantUid: string, dto: PublishJobDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const post = await this.prisma.jobPost.findUnique({ where: { id: dto.jobPostId } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.merchantId !== merchant.id) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
    if (post.status !== JobPostStatus.PENDING) {
      throw new BizException(50002, '岗位已发布或已下架，无需再次付费', HttpStatus.CONFLICT);
    }

    const pricing = await this.prisma.pricingConfig.findUnique({ where: { duration: dto.duration } });
    if (!pricing) throw new BizException(50004, '该档位单价未配置', HttpStatus.CONFLICT);

    const order = await this.prisma.paymentOrder.create({
      data: {
        merchantId: merchant.id,
        jobPostId: post.id,
        duration: dto.duration,
        amount: pricing.price,
        status: PayStatus.PENDING,
      },
    });

    // dev mock：直接完成
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信支付凭证未配置，无法发起支付', HttpStatus.SERVICE_UNAVAILABLE);
      }
      this.logger.warn('dev mode: mock pay & publish');
      await this.fulfillOrder(order.id);
      const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
      return {
        orderId: order.id,
        amount: refreshed!.amount.toString(),
        status: refreshed!.status,
        jobPostId: post.id,
        jobPostStatus: JobPostStatus.PUBLISHED,
        wxPayParams: null,
      };
    }

    // 真实 JSAPI 下单
    const user = await this.prisma.user.findUnique({
      where: { id: merchantUid },
      select: { openid: true },
    });
    if (!user?.openid) {
      throw new BizException(90003, '商家 openid 缺失，无法发起微信支付', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const amountInFen = Math.round(Number(order.amount.toString()) * 100);
    const notifyUrl = this.config.get<string>('WX_PAY_NOTIFY_URL')!;
    const { prepayId, wxPayParams } = await this.wxPay.createJsapiOrder({
      outTradeNo: order.id,
      amountInFen,
      description: post.title || '岗位付费发布',
      openid: user.openid,
      notifyUrl,
    });
    await this.prisma.paymentOrder.update({ where: { id: order.id }, data: { wxPrepayId: prepayId } });
    return {
      orderId: order.id,
      amount: order.amount.toString(),
      status: PayStatus.PENDING,
      jobPostId: post.id,
      jobPostStatus: JobPostStatus.PENDING,
      wxPayParams,
    };
  }

  // 完成订单：置 PAID + 岗位 PUBLISHED + expireAt（幂等）
  async fulfillOrder(orderId: string, wxTransactionId?: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    if (order.status !== PayStatus.PENDING) return; // 已完成，幂等
    const days = order.duration === JobDuration.D90 ? 90 : 30;
    const expireAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: PayStatus.PAID, paidAt: new Date(), wxTransactionId: wxTransactionId ?? order.wxTransactionId },
      }),
      this.prisma.jobPost.update({
        where: { id: order.jobPostId },
        data: { status: JobPostStatus.PUBLISHED, expireAt },
      }),
    ]);
  }

  // 微信支付回调（prod）：验签 + AES-GCM 解密 -> fulfillOrder。dev 不触发（mock 已直接完成）。
  async notify(headers: Record<string, string | undefined>, rawBody: string) {
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信支付回调验签未接入', HttpStatus.SERVICE_UNAVAILABLE);
      }
      // dev 直达：body 内带 orderId（mock-pay / 手动测试用）
      const data = JSON.parse(rawBody) as { outTradeNo?: string; orderId?: string };
      const orderId = data.outTradeNo ?? data.orderId ?? '';
      if (!orderId) return { code: 'FAIL', message: 'no orderId' };
      await this.fulfillOrder(orderId);
      return { code: 'SUCCESS', message: 'OK' };
    }
    const dec = await this.wxPay.verifyAndDecryptCallback(headers, rawBody);
    const orderId = dec.out_trade_no;
    if (!orderId) return { code: 'FAIL', message: 'no out_trade_no' };
    await this.fulfillOrder(orderId, dec.transaction_id);
    return { code: 'SUCCESS', message: 'OK' };
  }

  // 退款回调（prod）：验签 + 解密 -> 置 REFUNDED。dev 不触发。
  async refundNotify(headers: Record<string, string | undefined>, rawBody: string) {
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信退款回调验签未接入', HttpStatus.SERVICE_UNAVAILABLE);
      }
      return { code: 'SUCCESS', message: 'OK' };
    }
    const dec = await this.wxPay.verifyAndDecryptCallback(headers, rawBody);
    const orderId = dec.out_trade_no;
    if (!orderId) return { code: 'FAIL', message: 'no out_trade_no' };
    await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: PayStatus.REFUNDING },
      data: { status: PayStatus.REFUNDED, refundedAt: new Date(), refundStatus: dec.refund_status ?? 'SUCCESS' },
    });
    return { code: 'SUCCESS', message: 'OK' };
  }

  // dev 专用：手动模拟支付完成（测试用）
  async mockPay(orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BizException(10003, 'prod 禁止 mock 支付', HttpStatus.FORBIDDEN);
    }
    await this.fulfillOrder(orderId);
    return { orderId, status: PayStatus.PAID };
  }

  // 申请退款：
  // - 凭证齐全：调微信退款 API，订单置 REFUNDING + 记 wxRefundId + 立即下架岗位；最终 REFUNDED 由退款回调确认。
  // - 凭证缺失 + dev：mock 直接 REFUNDED + 下架。
  // - 凭证缺失 + prod：90003。
  async refundOrder(merchantUid: string, orderId: string, reason?: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || order.merchantId !== merchant.id) {
      throw new BizException(10003, '无权操作该订单', HttpStatus.FORBIDDEN);
    }
    if (order.status === PayStatus.REFUNDED || order.status === PayStatus.REFUNDING) {
      return this.toOrderVo(order);
    }
    if (order.status !== PayStatus.PAID) {
      throw new BizException(50005, '只有已支付订单可以退款', HttpStatus.CONFLICT);
    }

    // dev mock
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信支付真实退款未接入', HttpStatus.SERVICE_UNAVAILABLE);
      }
      const refundedAt = new Date();
      const updated = await this.prisma.$transaction(async (tx) => {
        const o = await tx.paymentOrder.update({
          where: { id: orderId },
          data: { status: PayStatus.REFUNDED, refundedAt, refundReason: reason ?? '商家申请退款', refundStatus: 'SUCCESS' },
        });
        await tx.jobPost.updateMany({
          where: { id: order.jobPostId, status: JobPostStatus.PUBLISHED },
          data: { status: JobPostStatus.TAKEN_DOWN },
        });
        return o;
      });
      this.logger.warn(`dev mode: mock refund order ${orderId}`);
      return this.toOrderVo(updated);
    }

    // 真实退款
    const amountInFen = Math.round(Number(order.amount.toString()) * 100);
    const notifyUrl = this.config.get<string>('WX_PAY_REFUND_NOTIFY_URL')!;
    const { refundId, status } = await this.wxPay.createRefund({
      outTradeNo: order.id,
      outRefundNo: order.id, // 一单一退，同号幂等
      amountInFen,
      refundAmountInFen: amountInFen,
      reason: reason ?? '商家申请退款',
      notifyUrl,
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: PayStatus.REFUNDING,
          wxRefundId: refundId,
          refundStatus: status,
          refundReason: reason ?? '商家申请退款',
        },
      });
      // 退款一经受理立即下架岗位，避免继续招募
      await tx.jobPost.updateMany({
        where: { id: order.jobPostId, status: JobPostStatus.PUBLISHED },
        data: { status: JobPostStatus.TAKEN_DOWN },
      });
      return o;
    });
    return this.toOrderVo(updated);
  }

  // 查订单状态
  async getOrder(merchantUid: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || order.merchantId !== merchant.id) {
      throw new BizException(10003, '无权查看该订单', HttpStatus.FORBIDDEN);
    }
    return this.toOrderVo(order);
  }

  // M6-05 订单状态兜底查询：商家可主动刷新，按微信真实状态对账本地。
  // - PENDING + 微信 SUCCESS -> 补完成；PENDING + 微信 CLOSED/REVOKED/PAYERROR -> 置 CLOSED。
  // - REFUNDING -> 查退款，SUCCESS -> REFUNDED。
  // - 凭证缺失：仅返回本地状态。
  async syncOrderStatus(merchantUid: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || order.merchantId !== merchant.id) {
      throw new BizException(10003, '无权操作该订单', HttpStatus.FORBIDDEN);
    }

    let message = '';
    if (this.wxPay.isReady()) {
      if (order.status === PayStatus.PENDING) {
        const { transactionId, tradeState } = await this.wxPay.queryOrder(order.id);
        if (tradeState === 'SUCCESS') {
          await this.fulfillOrder(order.id, transactionId);
          message = '微信已确认支付，订单已补完成';
        } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(tradeState)) {
          await this.prisma.paymentOrder.update({ where: { id: orderId }, data: { status: PayStatus.CLOSED } });
          message = `微信订单状态 ${tradeState}，本地已置关闭`;
        } else {
          message = `微信订单状态：${tradeState}，待支付`;
        }
      } else if (order.status === PayStatus.REFUNDING) {
        const { status: rStatus } = await this.wxPay.queryRefund(order.id);
        if (rStatus === 'SUCCESS') {
          await this.prisma.paymentOrder.update({
            where: { id: orderId },
            data: { status: PayStatus.REFUNDED, refundedAt: new Date(), refundStatus: 'SUCCESS' },
          });
          message = '退款已完成';
        } else {
          await this.prisma.paymentOrder.update({ where: { id: orderId }, data: { refundStatus: rStatus } });
          message = `退款处理中（${rStatus}）`;
        }
      }
    } else {
      message = 'dev 模式仅返回本地状态';
    }

    const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    return { ...this.toOrderVo(refreshed!), message };
  }

  private toOrderVo(order: {
    id: string;
    jobPostId: string;
    duration: JobDuration;
    amount: { toString(): string };
    status: PayStatus;
    paidAt: Date | null;
    refundedAt: Date | null;
    refundReason: string | null;
    wxTransactionId: string | null;
    wxRefundId: string | null;
    refundStatus: string | null;
    createdAt: Date;
  }) {
    return {
      orderId: order.id,
      jobPostId: order.jobPostId,
      duration: order.duration,
      amount: order.amount.toString(),
      status: order.status,
      paidAt: order.paidAt?.toISOString() ?? null,
      refundedAt: order.refundedAt?.toISOString() ?? null,
      refundReason: order.refundReason,
      wxTransactionId: order.wxTransactionId,
      wxRefundId: order.wxRefundId,
      refundStatus: order.refundStatus,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
