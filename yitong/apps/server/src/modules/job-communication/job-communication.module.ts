import { Module } from '@nestjs/common';
import { JobCommunicationController } from './job-communication.controller';
import { JobCommunicationService } from './job-communication.service';

@Module({
  controllers: [JobCommunicationController],
  providers: [JobCommunicationService],
  exports: [JobCommunicationService],
})
export class JobCommunicationModule {}
