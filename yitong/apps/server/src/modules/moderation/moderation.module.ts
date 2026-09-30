import { Global, Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';

// 全局内容安全模块：被 confession / treehole / job 等发帖/评论接口内联调用（无 controller）
@Global()
@Module({
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
