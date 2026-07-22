import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TreeholeService } from './treehole.service';

// P1-17 限时聊天：每小时扫过期活跃匹配关闭（惰性关闭在 match 时触发，此为补充清理）
@Injectable()
export class TreeholeScheduler {
  private readonly logger = new Logger(TreeholeScheduler.name);

  constructor(private readonly treehole: TreeholeService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async closeExpiredMatches() {
    try {
      const r = await this.treehole.closeExpiredMatches();
      if (r.closed > 0) this.logger.log(`closed ${r.closed} expired matches`);
    } catch (e: unknown) {
      this.logger.warn(`closeExpiredMatches failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
