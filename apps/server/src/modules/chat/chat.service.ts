import { HttpStatus, Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, type ChatMessage } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

export interface MessageVo {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  createdAt: string;
}

export interface MessageListResult {
  list: MessageVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SessionVo {
  peerId: string;
  lastMessage: string;
  lastAt: string;
}

// 聊天业务层：消息持久化 + 会话列表 + 历史拉取。
// fromId/toId 为标识符（实名 uid 或树洞 anonId），不假设与 User 表关联，匿名隔离由调用方保证。
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // 发消息：存 ChatMessage + 双向更新 ChatSession（双方都能看到）
  async sendMessage(fromId: string, toId: string, content: string): Promise<MessageVo> {
    if (!(await this.canSendDirectMessage(fromId, toId))) {
      throw new BizException(30003, '匿名会话未匹配，不能发送消息', HttpStatus.FORBIDDEN);
    }
    const msg = await this.prisma.$transaction(async (tx) => {
      const m = await tx.chatMessage.create({ data: { fromId, toId, content } });
      await tx.chatSession.upsert({
        where: { ownerId_peerId: { ownerId: fromId, peerId: toId } },
        update: { lastMessage: content, lastAt: m.createdAt },
        create: { ownerId: fromId, peerId: toId, lastMessage: content, lastAt: m.createdAt },
      });
      await tx.chatSession.upsert({
        where: { ownerId_peerId: { ownerId: toId, peerId: fromId } },
        update: { lastMessage: content, lastAt: m.createdAt },
        create: { ownerId: toId, peerId: fromId, lastMessage: content, lastAt: m.createdAt },
      });
      return m;
    });
    return this.toMsgVo(msg);
  }

  // 消息历史（双向，游标分页；游标 = 上一页最早一条的 createdAt，往更旧拉）
  async listMessages(
    ownerId: string,
    peerId: string,
    cursor?: string,
    limit = 50,
  ): Promise<MessageListResult> {
    const where: Prisma.ChatMessageWhereInput = {
      OR: [
        { fromId: ownerId, toId: peerId },
        { fromId: peerId, toId: ownerId },
      ],
    };
    if (cursor) {
      const t = new Date(cursor);
      if (!Number.isNaN(t.getTime())) where.createdAt = { lt: t };
    }
    const msgs = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = msgs.length > limit;
    const slice = hasMore ? msgs.slice(0, limit) : msgs;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
    // 反转为时间正序（旧->新）便于展示
    const list = slice.map((m) => this.toMsgVo(m)).reverse();
    return { list, nextCursor, hasMore };
  }

  async listSessions(ownerId: string): Promise<SessionVo[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { ownerId },
      orderBy: { lastAt: 'desc' },
    });
    return sessions.map((s) => ({
      peerId: s.peerId,
      lastMessage: s.lastMessage,
      lastAt: s.lastAt.toISOString(),
    }));
  }

  private toMsgVo(m: ChatMessage): MessageVo {
    return {
      id: m.id,
      fromId: m.fromId,
      toId: m.toId,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    };
  }

  private async canSendDirectMessage(from: string, to: string): Promise<boolean> {
    const fromAnon = this.isAnonIdentifier(from);
    const toAnon = this.isAnonIdentifier(to);
    if (!fromAnon && !toAnon) return true;
    if (!fromAnon || !toAnon) return false;
    const match = await this.prisma.chatMatch.findFirst({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [
          { anonIdA: from, anonIdB: to },
          { anonIdA: to, anonIdB: from },
        ],
      },
      select: { id: true },
    });
    return !!match;
  }

  private isAnonIdentifier(id: string): boolean {
    return id.startsWith('anon_');
  }
}
