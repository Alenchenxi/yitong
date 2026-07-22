import { HttpStatus, Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, type ChatMessage } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';

export interface MessageVo {
  id: string;
  fromId: string;
  toId: string | null; // P2-11 群消息时为 null
  content: string;
  type: string; // text / image / voice
  duration: number | null; // 语音时长（秒），仅 type=voice
  groupId: string | null; // P2-11 群消息时为群 id
  deleted: boolean; // P2-11 已撤回
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  // 发消息：存 ChatMessage + 双向更新 ChatSession（双方都能看到）
  // P1-18 voice：duration 为秒（1-60），语音不做内联文本/图片审核（异步语音审核留 P3-06）
  async sendMessage(
    fromId: string,
    toId: string,
    content: string,
    type = 'text',
    duration?: number,
  ): Promise<MessageVo> {
    if (!(await this.canSendDirectMessage(fromId, toId))) {
      throw new BizException(30003, '匿名会话未匹配，不能发送消息', HttpStatus.FORBIDDEN);
    }
    const msgType = type === 'image' || type === 'voice' ? type : 'text';
    let msgDuration: number | null = null;
    if (msgType === 'voice') {
      const d = duration ?? 0;
      if (!Number.isInteger(d) || d < 1 || d > 60) {
        throw new BizException(30004, '语音时长无效', HttpStatus.BAD_REQUEST);
      }
      msgDuration = d;
    }
    // P0-15 聊天安全审核：文字 checkText / 图片 checkImage（命中违规抛 90002）
    if (msgType === 'image') {
      await this.moderation.checkImage(content);
    } else if (msgType === 'text') {
      await this.moderation.checkText(content);
    }
    const msg = await this.prisma.$transaction(async (tx) => {
      const m = await tx.chatMessage.create({
        data: { fromId, toId, content, type: msgType, duration: msgDuration },
      });
      const lastMessage = msgType === 'image' ? '[图片]' : msgType === 'voice' ? '[语音]' : content;
      await tx.chatSession.upsert({
        where: { ownerId_peerId: { ownerId: fromId, peerId: toId } },
        update: { lastMessage, lastAt: m.createdAt },
        create: { ownerId: fromId, peerId: toId, lastMessage, lastAt: m.createdAt },
      });
      await tx.chatSession.upsert({
        where: { ownerId_peerId: { ownerId: toId, peerId: fromId } },
        update: { lastMessage, lastAt: m.createdAt },
        create: { ownerId: toId, peerId: fromId, lastMessage, lastAt: m.createdAt },
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

  // ===== P2-11 群聊消息 =====

  // 发群消息（文字/图片，禁言拦截由调用方 treehole.service 处理）
  async sendGroupMessage(fromId: string, groupId: string, content: string, type = 'text'): Promise<MessageVo> {
    const msgType = type === 'image' ? 'image' : 'text';
    if (msgType === 'image') {
      await this.moderation.checkImage(content);
    } else {
      await this.moderation.checkText(content);
    }
    const m = await this.prisma.chatMessage.create({
      data: { fromId, toId: null, groupId, content, type: msgType },
    });
    return this.toMsgVo(m);
  }

  // 群消息历史（游标分页）
  async listGroupMessages(groupId: string, cursor?: string, limit = 50) {
    const where: { groupId: string; deletedAt: null; OR?: object[]; createdAt?: object } = {
      groupId,
      deletedAt: null,
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
    return {
      list: slice.reverse().map((m) => this.toMsgVo(m)),
      nextCursor,
      hasMore,
    };
  }

  // 撤回消息（仅发送者可撤回，标记 deletedAt）
  async revokeMessage(operatorId: string, messageId: string) {
    const m = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!m) throw new BizException(30010, '消息不存在');
    if (m.fromId !== operatorId) throw new BizException(10003, '只能撤回自己的消息', HttpStatus.FORBIDDEN);
    if (m.deletedAt) return this.toMsgVo(m);
    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: '[已撤回]' },
    });
    return this.toMsgVo(updated);
  }

  private toMsgVo(m: ChatMessage): MessageVo {
    return {
      id: m.id,
      fromId: m.fromId,
      toId: m.toId,
      content: m.deletedAt ? '[已撤回]' : m.content,
      type: m.type,
      duration: m.duration,
      groupId: m.groupId,
      deleted: !!m.deletedAt,
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
    if (!match) return false;
    // P0-16 屏蔽双向隔离（防御纵深，覆盖直调 chat 路径与 WS 网关同源检查）
    const blocked = await this.prisma.anonBlock.findFirst({
      where: {
        OR: [
          { blockerAnonId: from, blockedAnonId: to },
          { blockerAnonId: to, blockedAnonId: from },
        ],
      },
      select: { id: true },
    });
    return !blocked;
  }

  private isAnonIdentifier(id: string): boolean {
    return id.startsWith('anon_');
  }
}
