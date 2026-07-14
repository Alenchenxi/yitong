import { Module } from '@nestjs/common';
import { ConfessionModule } from '../confession/confession.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ConfessionModule],
  controllers: [AdminController],
  providers: [AdminService, DashboardService],
  exports: [AdminService],
})
export class AdminModule {}
