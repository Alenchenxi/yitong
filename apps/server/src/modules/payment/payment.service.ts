import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobDuration,
  JobPostStatus,
  PayStatus,
  Prisma,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublishJobDto } from './dto/payment.dto';

// 错误码 5xxxx 支付段（API §3）：50001 订单不存在 / 50002 订单已完成或无效 / 50003 金额不匹配 / 50004 单价未配置
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // 付费发布：按 PricingConfig 计价下单。dev 直接完成（mock 支付 -> 置 PUBLISHED + expireAt）；
  // prod 调微信支付 JSAPI 下单，返回 wxPayParams，等 /payments/notify 回调置 PUBLISHED。
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

    if (process.env.NODE_ENV !== 'production') {
      // dev：mock 支付完成，直接发布
      this.logger.warn('dev mode: mock pay & publish');
      await this.fulfillOrder(order.id);
      const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
      return {
        orderId: order.id,
        amount: refreshed!.amount.toString(),
        status: refreshed!.status,
        jobPostId: post.id,
        jobPostStatus: JobPostStatus.PUBLISHED,
      };
    }

    // TODO(prod): 调微信支付 V3 JSAPI 下单，存 wxPrepayId，返回 wxPayParams 供小程序拉起支付
    // 当前未配商户证书，回退 mock（生产前必须实现真实下单）
    this.logger.warn('WX Pay credentials not set; falling back to mock publish');
    await this.fulfillOrder(order.id);
    const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
    return {
      orderId: order.id,
      amount: refreshed!.amount.toString(),
      status: refreshed!.status,
      jobPostId: post.id,
      jobPostStatus: JobPostStatus.PUBLISHED,
    };
  }

  // 完成订单：置 PAID + 岗位 PUBLISHED + expireAt（幂等）
  async fulfillOrder(orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    if (order.status !== PayStatus.PENDING) return; // 已完成，幂等
    const days = order.duration === JobDuration.D90 ? 90 : 30;
    const expireAt = new Date(Date.now() + days * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: PayStatus.PAID, paidAt: new Date() },
      }),
      this.prisma.jobPost.update({
        where: { id: order.jobPostId },
        data: { status: JobPostStatus.PUBLISHED, expireAt },
      }),
    ]);
  }

  // 微信支付回调（prod）：验签 -> fulfillOrder。dev 不触发。
  // 真实验签需解析 V3 回调 header + 证书验签，待商户证书配置后实现；当前按 orderId 直达（仅适合 dev）。
  async notify(body: unknown) {
    // TODO(prod): 用 WX_PAY_API_V3_KEY 解密 resource，校验签名，取 out_trade_no
    const data = body as { outTradeNo?: string; orderId?: string };
    const orderId = data.outTradeNo ?? data.orderId ?? '';
    if (!orderId) return { code: 'FAIL', message: 'no orderId' };
    await this.fulfillOrder(orderId);
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

  // 查询订单状态
  async getOrder(merchantUid: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || order.merchantId !== merchant.id) {
      throw new BizException(10003, '无权查看该订单', HttpStatus.FORBIDDEN);
    }
    return {
      orderId: order.id,
      jobPostId: order.jobPostId,
      duration: order.duration,
      amount: order.amount.toString(),
      status: order.status,
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
