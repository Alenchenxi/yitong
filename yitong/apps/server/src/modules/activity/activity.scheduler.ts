import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActivityReminderKind, ActivityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from './activity.service';

// 活动定时任务：状态机推进 + T-3d/T-1d 自动提醒（specs/features/活动模块.md §4.1/4.7）
// 候补转正是事件驱动（取消报名/取消资格时同步处理），不经 cron。
@Injectable()
export class ActivityScheduler {
  private readonly logger = new Logger(ActivityScheduler.name);
  private running = false; // 防重入（对齐 tutor-sync 模式）

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.advanceStatuses();
      await this.autoReminders();
    } catch (e) {
      this.logger.warn(`activity scheduler failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.running = false;
    }
  }

  /** 状态推进：PUBLISHED→UPCOMING（报名截止）→ONGOING（到开始时间）→ENDED（到结束时间，群聊 +7 天只读） */
  private async advanceStatuses(): Promise<void> {
    const now = new Date();
    // 报名截止（或到开始时间）后未开始 → UPCOMING
    await this.prisma.activity.updateMany({
      where: {
        status: ActivityStatus.PUBLISHED,
        startTime: { not: null, lte: now },
      },
      data: { status: ActivityStatus.ONGOING },
    });
    const published = await this.prisma.activity.findMany({
      where: { status: ActivityStatus.PUBLISHED, startTime: { not: null } },
      select: { id: true, enrollEndAt: true, startTime: true },
    });
    for (const a of published) {
      const deadline = a.enrollEndAt ?? a.startTime;
      if (deadline && now >= deadline && now < a.startTime!) {
        await this.prisma.activity.update({ where: { id: a.id }, data: { status: ActivityStatus.UPCOMING } });
      }
    }
    // ONGOING → ENDED（endTime 到点，群聊只读时间 = endTime + 7 天，AC-031）
    const ended = await this.prisma.activity.findMany({
      where: { status: ActivityStatus.ONGOING, endTime: { not: null, lte: now }, chatReadonlyAt: null },
      select: { id: true, endTime: true },
    });
    for (const a of ended) {
      const readonlyAt = new Date(a.endTime!.getTime() + 7 * 24 * 3600 * 1000);
      await this.prisma.activity.update({
        where: { id: a.id },
        data: { status: ActivityStatus.ENDED, chatReadonlyAt: readonlyAt },
      });
    }
  }

  /** 自动提醒：开始前三天 [T-72h, T-24h) 与前一天 [T-24h, T)；错过窗口自然跳过（AC-020） */
  private async autoReminders(): Promise<void> {
    const now = Date.now();
    const candidates = await this.prisma.activity.findMany({
      where: {
        status: { in: [ActivityStatus.PUBLISHED, ActivityStatus.UPCOMING, ActivityStatus.ONGOING] },
        startTime: { not: null },
      },
    });
    for (const a of candidates) {
      const t = a.startTime!.getTime();
      const in3d = now >= t - 72 * 3600 * 1000 && now < t - 24 * 3600 * 1000;
      const in1d = now >= t - 24 * 3600 * 1000 && now < t;
      if (!in3d && !in1d) continue;
      await this.activity.sendAutoReminders(a, in3d ? ActivityReminderKind.AUTO_3D : ActivityReminderKind.AUTO_1D);
    }
  }
}
