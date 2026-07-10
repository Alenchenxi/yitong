import { Global, Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ImService } from './im.service';

// 全局聊天模块：ImService 供 treehole（匿名聊/派对房）/ job（站内沟通）/ 客服注入消费
@Global()
@Module({
  controllers: [ChatController],
  providers: [ChatService, ImService, ChatGateway],
  exports: [ChatService, ImService],
})
export class ChatModule {}
