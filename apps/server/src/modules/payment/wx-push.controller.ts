import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { PaymentService } from './payment.service';

// 微信公众平台「消息推送」接收端（appid 级配置：开发设置 -> 消息推送，明文 JSON 模式）。
// 一个 appid 的消息推送只能指向一个 URL，虚拟支付事件与未来其他平台事件都从这里进。
// - GET：URL 有效性验证，sha1 验签通过后原样返回 echostr
// - POST：虚拟支付事件推送（xpay_goods_deliver_notify 发货 / xpay_refund_notify 退款），
//   处理成功应答 {"ErrCode":0}；返回非 0 或非 2xx 时微信按 2/4/8...s 重试，最多 15 次。
@Controller('wx-push')
export class WxPushController {
  constructor(
    private readonly payment: PaymentService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  verify(
    @Query('signature') signature = '',
    @Query('timestamp') timestamp = '',
    @Query('nonce') nonce = '',
    @Query('echostr') echostr = '',
    @Res() res: Response,
  ): void {
    if (this.verifySignature(signature, timestamp, nonce)) {
      res.send(echostr);
    } else {
      res.status(403).send('invalid signature');
    }
  }

  @Public()
  @Post()
  async handle(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown> | string> {
    res.status(200);
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8') ?? '';
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      /* 非法 JSON：按未知事件应答 success 结束，避免无意义重试 */
    }
    const event = typeof payload.Event === 'string' ? payload.Event : '';
    try {
      if (event === 'xpay_goods_deliver_notify') {
        return await this.payment.xpayDeliverNotify(payload);
      }
      if (event === 'xpay_refund_notify') {
        return await this.payment.xpayRefundNotify(payload);
      }
      return 'success';
    } catch (e) {
      // 临时性失败（网络/微信侧超时等）：非 0 应答让微信重试；order 缺失等永久失败已在 service 消化
      return { ErrCode: -1, ErrMsg: e instanceof Error ? e.message : String(e) };
    }
  }

  // 微信消息推送验签：sha1(sort(token, timestamp, nonce) 拼接) 与 signature 比对
  private verifySignature(signature: string, timestamp: string, nonce: string): boolean {
    const token = this.config.get<string>('WX_PUSH_TOKEN') ?? '';
    if (!token || !signature || !timestamp || !nonce) return false;
    const expected = crypto
      .createHash('sha1')
      .update([token, timestamp, nonce].sort().join(''))
      .digest('hex');
    return expected === signature;
  }
}
