import { Global, Module } from '@nestjs/common';
import { PublicationPolicyService } from './publication-policy.service';

@Global()
@Module({
  providers: [PublicationPolicyService],
  exports: [PublicationPolicyService],
})
export class PublicationModule {}
