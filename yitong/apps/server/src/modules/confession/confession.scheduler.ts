import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfessionService } from './confession.service';

// P1-04 热评置顶：每小时整点刷新各帖热度 top 2 评论为置顶
@Injectable()
export class ConfessionScheduler {
  private readonly logger = new Logger(ConfessionScheduler.name);

  constructor(private readonly confession: ConfessionService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshHotPins() {
    try {
      await this.confession.refreshHotPins();
    } catch (e: unknown) {
      this.logger.warn(`refreshHotPins failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // P2-06 定时发布：每分钟扫到点的草稿帖，转公开 + 审核
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledPosts() {
    try {
      const r = await this.confession.publishScheduledPosts();
      if (r.published > 0 || r.failed > 0) {
        this.logger.log(`publishScheduledPosts: published=${r.published} failed=${r.failed}`);
      }
    } catch (e: unknown) {
      this.logger.warn(`publishScheduledPosts failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
