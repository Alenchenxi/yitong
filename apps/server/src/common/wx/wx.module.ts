import { Global, Module } from '@nestjs/common';
import { WxAccessTokenService } from './wx-access-token.service';
import { WxSubscribeMessageService } from './wx-subscribe-message.service';
import { WxPayService } from './wx-pay.service';

// 全局微信工具模块：提供平台级 access_token、订阅消息、微信支付 V3，供各模块消费
@Global()
@Module({
  providers: [WxAccessTokenService, WxSubscribeMessageService, WxPayService],
  exports: [WxAccessTokenService, WxSubscribeMessageService, WxPayService],
})
export class WxModule {}
