import { Body, Controller, HttpStatus, Param, Post, Req, Get, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ok } from '../../common/dto/api-response';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedRequest } from '../auth/types';
import { PaymentService } from './payment.service';
import { PublishJobDto, RefundPaymentDto } from './dto/payment.dto';

// V3 微信回调应答：SUCCESS 必须 2xx（200/204），FAIL 返 5xx 让微信重试
function setAckStatus(res: Response, code: string): void {
  res.status(code === 'SUCCESS' ? HttpStatus.OK : HttpStatus.INTERNAL_SERVER_ERROR);
}

@Controller('payments')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  // 付费发布岗位：按 PricingConfig 计价下单（金额服务端算）
  @Post('job-publish')
  async jobPublish(@Body() dto: PublishJobDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.payment.createJobPublishOrder(uid, dto));
  }

  // 微信支付回调（V3 JSON 加密报文，免鉴权）：验签 + 解密 -> 置 PAID
  @Public()
  @Post('notify')
  async notify(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    const r = await this.payment.notify(rawBody, {
      timestamp: this.headerString(req, 'wechatpay-timestamp'),
      nonce: this.headerString(req, 'wechatpay-nonce'),
      signature: this.headerString(req, 'wechatpay-signature'),
    });
    setAckStatus(res, r.code);
    return r;
  }

  // 微信退款回调（V3 JSON 加密报文，免鉴权）：验签 + 解密 -> REFUNDED + 下架
  @Public()
  @Post('refund-notify')
  async refundNotify(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    const r = await this.payment.refundNotify(rawBody, {
      timestamp: this.headerString(req, 'wechatpay-timestamp'),
      nonce: this.headerString(req, 'wechatpay-nonce'),
      signature: this.headerString(req, 'wechatpay-signature'),
    });
    setAckStatus(res, r.code);
    return r;
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

  // 订单状态兜底查询：按微信真实状态对账本地
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

  // express headers 取值统一小写兼容；缺失返回 undefined
  private headerString(req: Request, name: string): string | undefined {
    const v = req.headers[name];
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : undefined;
  }
}