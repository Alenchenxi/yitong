import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobScheduler } from './job.scheduler';
import { JobTemplateService } from './job-template.service';
import { LocationService } from './location.service';

@Module({
  controllers: [JobController],
  providers: [JobService, JobScheduler, JobTemplateService, LocationService],
  exports: [JobService, JobTemplateService, LocationService],
})
export class JobModule {}
