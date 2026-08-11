import { Module } from '@nestjs/common';
import { BoostController } from './boost.controller';
import { BoostService } from './boost.service';
import { BoostScheduler } from './boost.scheduler';

@Module({
  controllers: [BoostController],
  providers: [BoostService, BoostScheduler],
  exports: [BoostService],
})
export class BoostModule {}
