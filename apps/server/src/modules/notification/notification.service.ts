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
  extraId: string | null; // P1-01 附属定位 id（评论通知的 commentId）
  read: boolean;
  createdAt: string;
}

// 通知类型常量
export const NotificationType = {
  JOB_APPLY: 'job_apply',
  JOB_ACCEPT: 'job_accept',
  JOB_COMPLETE: 'job_complete',
  JOB_REJECT: 'job_reject',
  JOB_REVIEW_FROM_MERCHANT: 'job_review_from_merchant', // P1-26 商家评价学生
  JOB_APPLY_REMINDER: 'job_apply_reminder', // M4-02 报名处理提醒（懒检查）
  POST_TAKEDOWN: 'post_takedown',
  // P0-11 表白墙来源化消息
  POST_LIKE: 'post_like',
  POST_COMMENT: 'post_comment',
  COMMENT_REPLY: 'comment_reply',
  POST_FOLLOW: 'post_follow',
  // P1-02 评论点赞
  COMMENT_LIKE: 'comment_like',
  // P1-03 @用户
  COMMENT_MENTION: 'comment_mention',
  // P1-12 封禁 / 禁言
  USER_BANNED: 'user_banned',
  USER_MUTED: 'user_muted',
  // P1-28 举报处理结果
  REPORT_RESULT: 'report_result',
  // B 工单回复
  TICKET_REPLY: 'ticket_reply',
  // E4 支付成功（商家付费发布岗位完成）
  PAYMENT_PAID: 'payment_paid',
  // P2-26 圈子创建审核结果
  COMMUNITY_APPROVED: 'community_approved',
  COMMUNITY_REJECTED: 'community_rejected',
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
    extraId?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        extraId: params.extraId ?? null,
      },
    });
    void this.trySendSubscribeMessage(notification).catch((e: unknown) => {
      this.logger.warn(`subscribe message skipped: ${e instanceof Error ? e.message : String(e)}`);
    });
    return notification;
  }

  // P0-11 表白墙来源化消息：带 actor 的通知（自动取 actor 昵称、跳过自通知）。
  // content 为函数，避免 actor 昵称为空时拼接出 "undefined"。
  async createFromActor(params: {
    actorUid: string;
    targetUid: string;
    type: string;
    title: string;
    content: (actor: string) => string;
    targetType: string;
    targetId: string;
    extraId?: string;
  }): Promise<void> {
    if (params.targetUid === params.actorUid) return; // 不通知自己
    const actor = await this.prisma.user.findUnique({
      where: { id: params.actorUid },
      select: { nickname: true },
    });
    await this.create({
      userId: params.targetUid,
      type: params.type,
      title: params.title,
      content: params.content(actor?.nickname ?? '有人'),
      targetType: params.targetType,
      targetId: params.targetId,
      extraId: params.extraId,
    });
  }

  getSubscribeTemplates() {
    return this.wxSubscribe.getTemplates();
  }

  // M4-01 商家消息分类：按 type 映射到 category（不改 schema，查询时 in 过滤）
  private static CATEGORY_TYPE_MAP: Record<string, string[]> = {
    apply: [
      'job_apply',
      'job_accept',
      'job_complete',
      'job_reject',
      'job_review_from_merchant',
      'job_apply_reminder', // M4-02 报名处理提醒
    ],
    system: [
      'post_like',
      'post_comment',
      'comment_reply',
      'post_follow',
      'comment_like',
      'comment_mention',
      'post_takedown',
      'user_banned',
      'user_muted',
      'report_result',
      'ticket_reply',
      'community_approved', // P2-26 圈子审核通过
      'community_rejected', // P2-26 圈子审核拒绝
    ],
    // order 类：E4 支付成功通知（退款通知待退款闭环接入后补）
    order: ['payment_paid'],
  };

  static readonly CATEGORIES = ['apply', 'system', 'order'] as const;

  // 列表（分页 + 未读数，M4-01 支持 category 筛选）
  async list(
    userId: string,
    unreadOnly: boolean,
    page: number,
    pageSize: number,
    category?: 'apply' | 'system' | 'order',
  ) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.read = false;
    if (category) {
      const types = NotificationService.CATEGORY_TYPE_MAP[category];
      if (types && types.length > 0) {
        where.type = { in: types };
      } else {
        // order 类暂无 type，返回空
        where.type = { in: ['__none__'] };
      }
    }

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

  // M4-01 各分类未读数（供前端 tab 角标）
  async unreadCountByCategory(userId: string) {
    const entries = await Promise.all(
      NotificationService.CATEGORIES.map(async (cat) => {
        const types = NotificationService.CATEGORY_TYPE_MAP[cat] ?? [];
        const count =
          types.length > 0
            ? await this.prisma.notification.count({
                where: { userId, read: false, type: { in: types } },
              })
            : 0;
        return [cat, count] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<'apply' | 'system' | 'order', number>;
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
    extraId: string | null;
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
      extraId: n.extraId,
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
