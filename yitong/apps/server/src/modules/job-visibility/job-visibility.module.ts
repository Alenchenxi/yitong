import { Module } from '@nestjs/common';
import { JobVisibilityPolicyService } from './job-visibility.service';

@Module({
  providers: [JobVisibilityPolicyService],
  exports: [JobVisibilityPolicyService],
})
export class JobVisibilityModule {}
