import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LicenseService } from './license.service';

// 授权巡检：启动时拉取一次 + 每 30 分钟刷新
@Injectable()
export class LicenseScheduler implements OnModuleInit {
  private readonly logger = new Logger(LicenseScheduler.name);

  constructor(private readonly license: LicenseService) {}

  async onModuleInit(): Promise<void> {
    // fire-and-forget：不阻塞 app.listen；启动后几秒内拿到授权态，期间 fail-closed
    void this.license.refreshOnBoot().catch((e) => this.logger.error(`启动授权巡检失败: ${(e as Error).message}`));
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async refresh(): Promise<void> {
    await this.license.refresh();
  }
}
