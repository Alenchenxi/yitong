import { Global, Module } from '@nestjs/common';
import { WxAccessTokenService } from './wx-access-token.service';
import { WxSubscribeMessageService } from './wx-subscribe-message.service';
import { WxPayService } from './wx-pay.service';
import { WxXPayService } from './wx-xpay.service';

// 全局微信工具模块：提供平台级 access_token、订阅消息、微信支付 V3、虚拟支付，供各模块消费
@Global()
@Module({
  providers: [WxAccessTokenService, WxSubscribeMessageService, WxPayService, WxXPayService],
  exports: [WxAccessTokenService, WxSubscribeMessageService, WxPayService, WxXPayService],
})
export class WxModule {}
