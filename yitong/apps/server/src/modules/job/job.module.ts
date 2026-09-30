import { Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobScheduler } from './job.scheduler';
import { JobTemplateService } from './job-template.service';
import { LocationService } from './location.service';
import { TutorSyncModule } from '../tutor-sync/tutor-sync.module';
import { JobVisibilityModule } from '../job-visibility/job-visibility.module';

@Module({
  imports: [TutorSyncModule, JobVisibilityModule],
  controllers: [JobController],
  providers: [JobService, JobScheduler, JobTemplateService, LocationService],
  exports: [JobService, JobTemplateService, LocationService],
})
export class JobModule {}
