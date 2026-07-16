import { Global, Module } from '@nestjs/common';
import { WxAccessTokenService } from './wx-access-token.service';
import { WxSubscribeMessageService } from './wx-subscribe-message.service';

// 全局微信工具模块：提供平台级 access_token，供 moderation 等模块消费
@Global()
@Module({
  providers: [WxAccessTokenService, WxSubscribeMessageService],
  exports: [WxAccessTokenService, WxSubscribeMessageService],
})
export class WxModule {}
