import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TutorSyncService } from './tutor-sync.service';

@Injectable()
export class TutorSyncScheduler {
  private readonly logger = new Logger(TutorSyncScheduler.name);
  private running = false;

  constructor(private readonly tutorSync: TutorSyncService) {}

  @Cron('*/5 * * * *')
  async synchronizeTutorDemands() {
    if (!this.tutorSync.isEnabled() || this.running) return;
    this.running = true;
    try {
      return await this.tutorSync.synchronize();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`tutor sync failed: ${message}`);
      return undefined;
    } finally {
      this.running = false;
    }
  }
}