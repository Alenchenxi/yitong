import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedRequest } from '../auth/types';
import { PaymentService } from './payment.service';
import { PublishJobDto, RefundPaymentDto } from './dto/payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  // 付费发布岗位：按 PricingConfig 计价下单（金额服务端算）
  @Post('job-publish')
  async jobPublish(@Body() dto: PublishJobDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.payment.createJobPublishOrder(uid, dto));
  }

  // 微信支付回调（免鉴权）：验签 + 解密 -> 置 PUBLISHED
  @Public()
  @Post('notify')
  async notify(@Req() req: Request) {
    const headers = req.headers as unknown as Record<string, string | undefined>;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    return ok(await this.payment.notify(headers, rawBody));
  }

  // 微信退款回调（免鉴权）：验签 + 解密 -> 置 REFUNDED
  @Public()
  @Post('refund-notify')
  async refundNotify(@Req() req: Request) {
    const headers = req.headers as unknown as Record<string, string | undefined>;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    return ok(await this.payment.refundNotify(headers, rawBody));
  }

  // dev 专用：模拟支付完成（prod 禁止）
  @Public()
  @Post('mock-pay/:orderId')
  async mockPay(@Param('orderId') orderId: string) {
    return ok(await this.payment.mockPay(orderId));
  }

  // 查订单状态
  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.payment.getOrder(uid, orderId));
  }

  // M6-05 订单状态兜底查询：按微信真实状态对账本地
  @Post(':orderId/sync')
  async sync(@Param('orderId') orderId: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.payment.syncOrderStatus(uid, orderId));
  }

  @Post(':orderId/refund')
  async refund(@Param('orderId') orderId: string, @Body() dto: RefundPaymentDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.payment.refundOrder(uid, orderId, dto.reason));
  }
}
