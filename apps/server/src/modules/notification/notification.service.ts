import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WxSubscribeMessageService } from '../../common/wx/wx-subscribe-message.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationVo {
  id: string;
  type: string;
  title: string;
  content: string;
  targetType: string | null;
  targetId: string | null;
  read: boolean;
  createdAt: string;
}

// 通知类型常量
export const NotificationType = {
  JOB_APPLY: 'job_apply',
  JOB_ACCEPT: 'job_accept',
  JOB_COMPLETE: 'job_complete',
  POST_TAKEDOWN: 'post_takedown',
} as const;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wxSubscribe: WxSubscribeMessageService,
  ) {}

  // 内部调用：创建通知（供其他 service 注入使用）
  async create(params: {
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType?: string;
    targetId?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
      },
    });
    void this.trySendSubscribeMessage(notification).catch((e: unknown) => {
      this.logger.warn(`subscribe message skipped: ${e instanceof Error ? e.message : String(e)}`);
    });
    return notification;
  }

  getSubscribeTemplates() {
    return this.wxSubscribe.getTemplates();
  }

  // 列表（分页 + 未读数）
  async list(userId: string, unreadOnly: boolean, page: number, pageSize: number) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.read = false;

    const [list, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return {
      list: list.map((n) => this.toVo(n)),
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  async markRead(id: string, userId: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) return null;
    if (!n.read) {
      await this.prisma.notification.update({ where: { id }, data: { read: true } });
    }
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }

  private toVo(n: {
    id: string;
    type: string;
    title: string;
    content: string;
    targetType: string | null;
    targetId: string | null;
    read: boolean;
    createdAt: Date;
  }): NotificationVo {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      targetType: n.targetType,
      targetId: n.targetId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  }

  private async trySendSubscribeMessage(n: {
    userId: string;
    type: string;
    title: string;
    content: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: Date;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: n.userId },
      select: { openid: true },
    });
    if (!user?.openid) return;
    await this.wxSubscribe.sendForNotification({
      openid: user.openid,
      type: n.type,
      title: n.title,
      content: n.content,
      targetType: n.targetType,
      targetId: n.targetId,
      createdAt: n.createdAt,
    });
  }
}
