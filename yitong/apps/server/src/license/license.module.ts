import { Module } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { LicenseGuard } from './license.guard';
import { LicenseScheduler } from './license.scheduler';
import { LicenseService } from './license.service';

@Module({
  controllers: [LicenseController],
  providers: [LicenseService, LicenseGuard, LicenseScheduler],
  exports: [LicenseService],
})
export class LicenseModule {}
