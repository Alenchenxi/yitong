import { HttpStatus, Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, type ChatMessage } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { ChatGateway } from './chat.gateway';

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
  unreadCount: number; // 未读消息数（前端列表显示红点）
}

// 聊天业务层：消息持久化 + 会话列表 + 历史拉取。
// fromId/toId 为标识符（实名 uid 或树洞 anonId），不假设与 User 表关联，匿名隔离由调用方保证。
// 撤回时效：仅 N 分钟内的消息可撤回（覆盖 1v1 + 群消息；超过返 40004）
const REVOKE_WINDOW_MS = 2 * 60 * 1000;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly gateway: ChatGateway,
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
    const result = await this.prisma.$transaction(async (tx) => {
      const m = await tx.chatMessage.create({
        data: { fromId, toId, content, type: msgType, duration: msgDuration },
      });
      const lastMessage = msgType === 'image' ? '[图片]' : msgType === 'voice' ? '[语音]' : content;
      await tx.chatSession.upsert({
        where: { ownerId_peerId: { ownerId: fromId, peerId: toId } },
        update: { lastMessage, lastAt: m.createdAt },
        create: { ownerId: fromId, peerId: toId, lastMessage, lastAt: m.createdAt, unreadCount: 0 },
      });
      // 接收方会话未读 +1；create 分支首次置 1
      const toSession = await tx.chatSession.upsert({
        where: { ownerId_peerId: { ownerId: toId, peerId: fromId } },
        update: { lastMessage, lastAt: m.createdAt, unreadCount: { increment: 1 } },
        create: { ownerId: toId, peerId: fromId, lastMessage, lastAt: m.createdAt, unreadCount: 1 },
      });
      return { msg: m, toUnread: toSession.unreadCount };
    });
    // 主动 forward 给对方（含真实 id 让对方能撤回匹配），不依赖发送方前端 WS 双发；对方不在线丢
    try {
      this.gateway.sendToUser(toId, {
        type: 'msg',
        fromId,
        content: result.msg.content,
        msgType,
        duration: result.msg.duration ?? undefined,
        id: result.msg.id,
        ts: result.msg.createdAt.getTime(),
      });
      // 未读数推送：让对方会话列表实时刷新（前端可显示红点）
      this.gateway.sendToUser(toId, {
        type: 'unread-update',
        peerId: fromId,
        unreadCount: result.toUnread,
        ts: Date.now(),
      });
    } catch {
      /* forward 失败不影响落库 */
    }
    return this.toMsgVo(result.msg);
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
      unreadCount: s.unreadCount,
    }));
  }

  // 未读清零（进入聊天页面时调，会话不存在则 updateMany 静默返回 count=0 不报错）
  async resetUnread(ownerId: string, peerId: string): Promise<void> {
    await this.prisma.chatSession.updateMany({
      where: { ownerId, peerId },
      data: { unreadCount: 0 },
    });
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
    // P2-11 实时广播给群房间在线成员（排除发送方，发送方靠前端乐观更新）；离线成员靠历史拉取。
    // 由后端主动广播，不依赖发送方前端 WS 双发，避免发送方 WS 断连时其他人收不到实时推送。
    // payload 带 id（真实 DB id），前端撤回广播靠它匹配。
    try {
      this.gateway.broadcastToRoom(
        `group:${groupId}`,
        {
          type: 'room-msg',
          roomId: `group:${groupId}`,
          id: m.id,
          fromId: m.fromId,
          content: m.content,
          msgType,
          ts: Date.now(),
        },
        m.fromId,
      );
    } catch {
      /* 广播失败不影响落库 */
    }
    return this.toMsgVo(m);
  }

  // 群系统消息：落库 ChatMessage(type='system', fromId='system') + WS 广播给在线成员。
  // actor/target 用 anonId + nick 快照（退群后历史文案仍可显示）；fromId='system' 不含真实 uid（匿名红线）。
  async sendGroupSystemMessage(
    groupId: string,
    action: string,
    actor: { anonId: string; nick: string },
    target?: { anonId: string; nick: string },
    extra?: Record<string, unknown>,
  ): Promise<MessageVo> {
    const content = JSON.stringify({ action, actor, target, extra });
    const m = await this.prisma.chatMessage.create({
      data: { fromId: 'system', toId: null, groupId, content, type: 'system' },
    });
    // 实时广播给群房间在线成员（离线成员靠历史拉取补偿）
    try {
      this.gateway.broadcastToRoom(`group:${groupId}`, {
        type: 'room-msg',
        roomId: `group:${groupId}`,
        fromId: 'system',
        content,
        msgType: 'system',
        ts: Date.now(),
      });
    } catch {
      /* 广播失败不影响落库 */
    }
    return this.toMsgVo(m);
  }

  // 群消息历史（游标分页）
  async listGroupMessages(groupId: string, cursor?: string, limit = 50) {
    const where: Prisma.ChatMessageWhereInput = {
      groupId,
      deletedAt: null,
    };
    const decodedCursor = cursor ? this.decodeGroupMessageCursor(cursor) : null;
    if (decodedCursor?.id) {
      where.OR = [
        { createdAt: { lt: decodedCursor.createdAt } },
        { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
      ];
    } else if (decodedCursor) {
      // Legacy clients sent a raw ISO timestamp.
      where.createdAt = { lt: decodedCursor.createdAt };
    }
    const msgs = await this.prisma.chatMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = msgs.length > limit;
    const slice = hasMore ? msgs.slice(0, limit) : msgs;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ t: last.createdAt.toISOString(), id: last.id })).toString('base64url')
      : null;
    return {
      list: slice.reverse().map((m) => this.toMsgVo(m)),
      nextCursor,
      hasMore,
    };
  }

  private decodeGroupMessageCursor(cursor: string): { createdAt: Date; id: string | null } | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        t?: unknown;
        id?: unknown;
      };
      const createdAt = new Date(String(parsed.t ?? ''));
      if (!Number.isNaN(createdAt.getTime()) && typeof parsed.id === 'string' && parsed.id) {
        return { createdAt, id: parsed.id };
      }
    } catch {
      // Fall through to the legacy ISO cursor.
    }
    const legacy = new Date(cursor);
    return Number.isNaN(legacy.getTime()) ? null : { createdAt: legacy, id: null };
  }

  // 撤回消息（仅发送者可撤回，标记 deletedAt）
  async revokeMessage(operatorId: string, messageId: string) {
    const m = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!m) throw new BizException(30010, '消息不存在');
    if (m.fromId !== operatorId) throw new BizException(10003, '只能撤回自己的消息', HttpStatus.FORBIDDEN);
    // 撤回时效：仅 2 分钟内的消息可撤（防止事后翻旧账误撤）
    if (Date.now() - m.createdAt.getTime() > REVOKE_WINDOW_MS) {
      throw new BizException(40004, `只能撤回 ${REVOKE_WINDOW_MS / 60000} 分钟内的消息`, HttpStatus.FORBIDDEN);
    }
    if (m.deletedAt) return this.toMsgVo(m);
    const updated = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: '[已撤回]' },
    });
    // 清 1v1 双方 ChatSession.lastMessage（会话列表展示用）
    if (!m.groupId && m.toId) {
      try {
        await this.prisma.chatSession.updateMany({
          where: {
            OR: [
              { ownerId: m.fromId, peerId: m.toId },
              { ownerId: m.toId, peerId: m.fromId },
            ],
          },
          data: { lastMessage: '[已撤回]' },
        });
      } catch {
        /* 清 lastMessage 失败不影响撤回落库 */
      }
    }
    // P2-11 撤回实时同步：群消息广播 room 排除操作方；1v1 forward 给 m.toId（对方在线才发，不在线靠历史拉取看到[已撤回]）
    if (m.groupId) {
      try {
        this.gateway.broadcastToRoom(
          `group:${m.groupId}`,
          {
            type: 'room-revoke',
            roomId: `group:${m.groupId}`,
            messageId: m.id,
            ts: Date.now(),
          },
          operatorId,
        );
      } catch {
        /* 广播失败不影响撤回落库 */
      }
    } else if (m.toId) {
      try {
        this.gateway.sendToUser(m.toId, {
          type: 'msg-revoke',
          fromId: m.fromId,
          messageId: m.id,
          ts: Date.now(),
        });
      } catch {
        /* forward 失败不影响撤回落库 */
      }
    }
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
