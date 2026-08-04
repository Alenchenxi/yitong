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
import { NotificationService, NotificationType } from '../notification/notification.service';
import type { PublishJobDto } from './dto/payment.dto';

// 错误码 5xxxx 支付段（API §3）：50001 订单不存在 / 50002 订单已完成或无效 / 50003 金额不匹配 / 50004 单价未配置 / 50005 退款不可用
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wxPay: WxPayService,
    private readonly notification: NotificationService,
  ) {}

  // 付费发布：按 PricingConfig 计价下单。金额服务端算，不信前端。
  // - 凭证齐全（isReady）：V3 JSAPI 下单，返回 wxPayParams 供前端 wx.requestPayment；订单留 PENDING，等回调置 PAID。
  // - 凭证缺失 + dev：mock 支付自动完成（置 PAID）。
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

    // 真实 V3 JSAPI 下单（V3 不再需要 spbill_create_ip）
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

  // 发布岗位单价预览（D30/D90）：商家支付页展示用，金额服务端按 PricingConfig 算，不下单
  async getJobPublishPricing() {
    const list = await this.prisma.pricingConfig.findMany();
    return list.map((p) => ({ duration: p.duration, price: p.price.toString() }));
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
    // 主动通知商家发布成功（PaymentOrder 无 relation，经 jobPost 取 merchant.userId）
    const post = await this.prisma.jobPost.findUnique({
      where: { id: order.jobPostId },
      include: { merchant: { select: { userId: true } } },
    });
    if (post?.merchant) {
      void this.notification
        .create({
          userId: post.merchant.userId,
          type: NotificationType.PAYMENT_PAID,
          title: '兼职 · 岗位已发布',
          content: `你的岗位「${post.title}」已支付成功并发布`,
          targetType: 'job_post',
          targetId: post.id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify payment paid failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
  }

  // 微信支付回调（V3 JSON 加密报文，prod）：验签 + 解密 + trade_state=SUCCESS -> fulfillOrder。
  // 返回 {code,message}，由 controller 转 HTTP 200/500（V3 失败非 2xx 让微信重试）。
  async notify(
    rawBody: string,
    headers: { timestamp?: string; nonce?: string; signature?: string },
  ): Promise<{ code: string; message: string }> {
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        return { code: 'FAIL', message: '微信支付回调未接入' };
      }
      // dev 直达：body 内带 orderId（mock-pay / 手动测试用）
      let orderId = '';
      try {
        const data = JSON.parse(rawBody) as { out_trade_no?: string; orderId?: string };
        orderId = data.out_trade_no ?? data.orderId ?? '';
      } catch {
        /* ignore */
      }
      if (!orderId) return { code: 'FAIL', message: 'no orderId' };
      await this.fulfillOrder(orderId);
      return { code: 'SUCCESS', message: 'OK' };
    }
    try {
      const dec = this.wxPay.verifyAndParseCallback(headers, rawBody);
      const orderId = typeof dec.out_trade_no === 'string' ? dec.out_trade_no : '';
      if (!orderId) return { code: 'FAIL', message: 'no out_trade_no' };
      if (dec.trade_state !== 'SUCCESS') {
        return { code: 'SUCCESS', message: 'ignored: trade_state not SUCCESS' };
      }
      const transactionId = typeof dec.transaction_id === 'string' ? dec.transaction_id : undefined;
      await this.fulfillOrder(orderId, transactionId);
      return { code: 'SUCCESS', message: 'OK' };
    } catch (e) {
      return { code: 'FAIL', message: (e as Error).message };
    }
  }

  // 微信退款回调（V3 JSON 加密报文，prod）：验签 + 解密 + refund_status=SUCCESS -> REFUNDED + 下架。
  async refundNotify(
    rawBody: string,
    headers: { timestamp?: string; nonce?: string; signature?: string },
  ): Promise<{ code: string; message: string }> {
    if (!this.wxPay.isReady()) {
      return { code: 'SUCCESS', message: 'OK' };
    }
    try {
      const dec = this.wxPay.verifyAndParseRefundCallback(headers, rawBody);
      const outTradeNo = typeof dec.out_trade_no === 'string' ? dec.out_trade_no : '';
      if (!outTradeNo) return { code: 'FAIL', message: 'no out_trade_no' };
      if (dec.refund_status === 'SUCCESS') {
        const refundId = typeof dec.refund_id === 'string' ? dec.refund_id : undefined;
        const order = await this.prisma.paymentOrder.findUnique({ where: { id: outTradeNo } });
        if (!order) return { code: 'SUCCESS', message: 'order not found' };
        await this.prisma.$transaction(async (tx) => {
          await tx.paymentOrder.updateMany({
            where: { id: outTradeNo, status: { in: [PayStatus.PAID, PayStatus.REFUNDING] } },
            data: {
              status: PayStatus.REFUNDED,
              refundedAt: new Date(),
              refundStatus: 'SUCCESS',
              ...(refundId ? { wxRefundId: refundId } : {}),
            },
          });
          await tx.jobPost.updateMany({
            where: { id: order.jobPostId, status: JobPostStatus.PUBLISHED },
            data: { status: JobPostStatus.TAKEN_DOWN },
          });
        });
        return { code: 'SUCCESS', message: 'OK' };
      }
      // ABNORMAL/CLOSED 等终态：仅更新退款子状态，不动订单主状态（保持 REFUNDING 等待人工）
      const refundId = typeof dec.refund_id === 'string' ? dec.refund_id : undefined;
      await this.prisma.paymentOrder.updateMany({
        where: { id: outTradeNo, status: PayStatus.REFUNDING },
        data: { refundStatus: dec.refund_status ?? 'ABNORMAL', ...(refundId ? { wxRefundId: refundId } : {}) },
      });
      return { code: 'SUCCESS', message: 'OK' };
    } catch (e) {
      return { code: 'FAIL', message: (e as Error).message };
    }
  }

  // dev 专用：手动模拟支付完成（测试用）
  async mockPay(orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BizException(10003, 'prod 禁止 mock 支付', HttpStatus.FORBIDDEN);
    }
    await this.fulfillOrder(orderId);
    return { orderId, status: PayStatus.PAID };
  }

  // 申请退款：V3 退款用同一套 RSA 签名，无需 V2 的 apiclient_cert.p12。
  // - 凭证缺失 + dev：mock 直接 REFUNDED + 下架（保留测试能力）。
  // - 凭证齐全：调 wxPay.refund；SUCCESS 立即 REFUNDED + 下架；PROCESSING 置 REFUNDING 等回调；
  //   CLOSED/ABNORMAL 退款失败，订单保持 PAID（仅记 refundStatus，订单仍有效）。
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
        throw new BizException(90003, '微信支付凭证未配置', HttpStatus.SERVICE_UNAVAILABLE);
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

    // 真实 V3 退款：out_refund_no 用订单 ID 加 R 后缀避免同订单复用冲突
    const amountInFen = Math.round(Number(order.amount.toString()) * 100);
    const refundNotifyUrl = this.config.get<string>('WX_PAY_REFUND_NOTIFY_URL') ?? undefined;
    const { refundId, status } = await this.wxPay.refund({
      outTradeNo: order.id,
      outRefundNo: `${order.id}_R1`,
      reason: reason ?? '商家申请退款',
      amountInFen,
      notifyUrl: refundNotifyUrl,
    });
    if (status === 'SUCCESS') {
      const updated = await this.prisma.$transaction(async (tx) => {
        const o = await tx.paymentOrder.update({
          where: { id: orderId },
          data: {
            status: PayStatus.REFUNDED,
            refundedAt: new Date(),
            refundReason: reason ?? '商家申请退款',
            refundStatus: 'SUCCESS',
            wxRefundId: refundId,
          },
        });
        await tx.jobPost.updateMany({
          where: { id: order.jobPostId, status: JobPostStatus.PUBLISHED },
          data: { status: JobPostStatus.TAKEN_DOWN },
        });
        return o;
      });
      return this.toOrderVo(updated);
    }
    if (status === 'PROCESSING') {
      // 退款处理中：置 REFUNDING，等退款回调（refundNotify）置 REFUNDED
      const updated = await this.prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: PayStatus.REFUNDING, refundReason: reason ?? '商家申请退款', refundStatus: status, wxRefundId: refundId },
      });
      return this.toOrderVo(updated);
    }
    // CLOSED / ABNORMAL：退款失败，订单保持 PAID（仅记 refundStatus，订单仍有效可重试）
    const updated = await this.prisma.paymentOrder.update({
      where: { id: orderId },
      data: { refundReason: reason ?? '商家申请退款', refundStatus: status, wxRefundId: refundId },
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

  // 订单状态兜底查询：商家可主动刷新，按微信真实状态对账本地。
  // - PENDING + 微信 SUCCESS -> 补完成；PENDING + 微信 CLOSED/REVOKED/PAYERROR -> 置 CLOSED。
  // - 凭证缺失：仅返回本地状态。
  async syncOrderStatus(merchantUid: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || order.merchantId !== merchant.id) {
      throw new BizException(10003, '无权操作该订单', HttpStatus.FORBIDDEN);
    }

    let message = '';
    if (this.wxPay.isReady() && order.status === PayStatus.PENDING) {
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