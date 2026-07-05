import { Module } from '@nestjs/common';
import { ConfessionController } from './confession.controller';
import { ConfessionService } from './confession.service';

@Module({
  controllers: [ConfessionController],
  providers: [ConfessionService],
})
export class ConfessionModule {}
