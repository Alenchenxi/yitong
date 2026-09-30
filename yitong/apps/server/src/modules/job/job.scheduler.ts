import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobPostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// 岗位到期下架定时任务：每小时扫描 PUBLISHED + expireAt<now -> EXPIRED
@Injectable()
export class JobScheduler {
  private readonly logger = new Logger(JobScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *')
  async expireJobPosts() {
    const result = await this.prisma.jobPost.updateMany({
      where: { status: JobPostStatus.PUBLISHED, expireAt: { lt: new Date() } },
      data: { status: JobPostStatus.EXPIRED },
    });
    if (result.count > 0) {
      this.logger.log(`cron: expired ${result.count} job posts`);
    }
    return { expired: result.count };
  }
}
