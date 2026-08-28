import { Module } from '@nestjs/common';
import { ConfessionModule } from '../confession/confession.module';
import { TutorSyncModule } from '../tutor-sync/tutor-sync.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ConfessionModule, TutorSyncModule],
  controllers: [AdminController],
  providers: [AdminService, DashboardService],
  exports: [AdminService],
})
export class AdminModule {}
