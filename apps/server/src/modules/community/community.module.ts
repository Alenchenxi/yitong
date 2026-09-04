import { Global, Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

// 圈子（Community）模块：@Global() 便于 confession/treehole/job/square 直接注入
// CommunityService（发帖/发岗写入 active community、浏览量埋点）
@Global()
@Module({
  imports: [ModerationModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
