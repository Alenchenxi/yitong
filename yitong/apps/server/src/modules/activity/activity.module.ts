import { Module } from '@nestjs/common';
import { ActivityController, LarkConnectionController } from './activity.controller';
import { ActivityScheduler } from './activity.scheduler';
import { ActivityService } from './activity.service';
import { LarkSyncService } from './lark-sync.service';

// 活动模块：依赖的 Chat / Notification / Moderation / Publication 均为 @Global 模块导出，无需重复 import
@Module({
  controllers: [ActivityController, LarkConnectionController],
  providers: [ActivityService, LarkSyncService, ActivityScheduler],
  exports: [ActivityService],
})
export class ActivityModule {}
