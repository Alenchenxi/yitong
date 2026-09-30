import { Module } from '@nestjs/common';
import { ConfessionController } from './confession.controller';
import { ConfessionScheduler } from './confession.scheduler';
import { ConfessionService } from './confession.service';

@Module({
  controllers: [ConfessionController],
  providers: [ConfessionService, ConfessionScheduler],
  exports: [ConfessionService],
})
export class ConfessionModule {}
