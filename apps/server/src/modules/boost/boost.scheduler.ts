import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BoostService } from './boost.service';

// 内容推广：每日凌晨 3 点清理过期 boostUntil（懒过滤 boostUntil > now 已保证 feed 正确，
// 此为数据整洁清理；推广历史在 PaymentOrder，不依赖此字段）。低峰执行避开业务高峰。
@Injectable()
export class BoostScheduler {
  private readonly logger = new Logger(BoostScheduler.name);

  constructor(private readonly boost: BoostService) {}

  @Cron('0 3 * * *')
  async cleanupExpiredBoosts() {
    try {
      const r = await this.boost.cleanupExpiredBoosts();
      if (r.posts > 0 || r.anonPosts > 0) {
        this.logger.log(`cleanupExpiredBoosts: posts=${r.posts} anonPosts=${r.anonPosts}`);
      }
    } catch (e: unknown) {
      this.logger.warn(`cleanupExpiredBoosts failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
