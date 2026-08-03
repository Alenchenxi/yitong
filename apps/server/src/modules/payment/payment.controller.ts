import { Body, Controller, Header, Param, Post, Req, Get } from '@nestjs/common';
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
    const clientIp = req.ip ?? '8.8.8.8';
    return ok(await this.payment.createJobPublishOrder(uid, dto, clientIp));
  }

  // 微信支付回调（V2 XML，免鉴权）：验签 -> 置 PUBLISHED，返回 V2 XML ack
  @Public()
  @Post('notify')
  @Header('Content-Type', 'text/xml; charset=utf-8')
  async notify(@Req() req: Request) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    const r = await this.payment.notify(rawBody);
    return `<xml><return_code><![CDATA[${r.code}]]></return_code><return_msg><![CDATA[${r.message}]]></return_msg></xml>`;
  }

  // 微信退款回调（V2 XML，免鉴权）：验签 -> 置 REFUNDED（退款当前隐藏，预留）
  @Public()
  @Post('refund-notify')
  @Header('Content-Type', 'text/xml; charset=utf-8')
  async refundNotify(@Req() req: Request) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    const r = await this.payment.refundNotify(rawBody);
    return `<xml><return_code><![CDATA[${r.code}]]></return_code><return_msg><![CDATA[${r.message}]]></return_msg></xml>`;
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
