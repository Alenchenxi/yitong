import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, DashboardService],
  exports: [AdminService],
})
export class AdminModule {}
