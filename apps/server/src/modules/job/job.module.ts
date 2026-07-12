import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobScheduler } from './job.scheduler';

@Module({
  controllers: [JobController],
  providers: [JobService, JobScheduler],
  exports: [JobService],
})
export class JobModule {}
