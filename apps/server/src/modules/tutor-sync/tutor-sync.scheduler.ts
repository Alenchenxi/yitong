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
    if (!this.tutorSync.isDeploymentEnabled() || this.running) return;
    this.running = true;
    try {
      return await this.tutorSync.synchronize();
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message.trim() || 'unknown error'}`
          : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`tutor sync failed: ${message}`, stack);
      return undefined;
    } finally {
      this.running = false;
    }
  }
}
