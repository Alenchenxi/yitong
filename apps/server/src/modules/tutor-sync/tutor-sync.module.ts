import { Module } from '@nestjs/common';
import { TutorDemandAdapter } from './tutor-demand.adapter';
import { TutorJobPolicyService } from './tutor-job-policy.service';
import { TutorPublisherService } from './tutor-publisher.service';
import { TutorSnapshotClient } from './tutor-snapshot.client';
import { TutorSyncScheduler } from './tutor-sync.scheduler';
import { TutorSyncSettingsService } from './tutor-sync.settings';
import { TutorSyncService } from './tutor-sync.service';

@Module({
  providers: [
    TutorDemandAdapter,
    TutorJobPolicyService,
    TutorPublisherService,
    TutorSnapshotClient,
    TutorSyncSettingsService,
    TutorSyncService,
    TutorSyncScheduler,
  ],
  exports: [TutorJobPolicyService],
})
export class TutorSyncModule {}
