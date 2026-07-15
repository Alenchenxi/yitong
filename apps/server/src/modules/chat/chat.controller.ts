import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import type { AuthenticatedRequest } from '../auth/types';
import { ChatService } from './chat.service';
import { ImService } from './im.service';
import { ChatQueryDto } from './dto/chat-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

// 聊天接口：IM 凭证签发 + 消息收发（落库）+ 历史拉取 + 会话列表。
// 实时传输由 MobileIMSDK 服务端承担（ImService 签证），消息持久化在 NestJS 侧。
@Controller('chat')
export class ChatController {
  constructor(
    private readonly im: ImService,
    private readonly chat: ChatService,
  ) {}

  // 换取 IM 登录凭证（loginUserId=uid；树洞匿名由 treehole 模块用 anonId 调 ImService）
  @Post('token')
  async token(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    return ok(await this.im.getImCredential(uid));
  }

  @Post('messages')
  async send(@Body() dto: SendMessageDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    return ok(await this.chat.sendMessage(uid, dto.peerId, dto.content));
  }

  @Get('messages')
  async list(@Query() q: ChatQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    return ok(await this.chat.listMessages(uid, q.peerId, q.cursor, clampLimit(q.limit, 50, 1, 100)));
  }

  @Get('sessions')
  async sessions(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    return ok(await this.chat.listSessions(uid));
  }
}

function clampLimit(raw: number | undefined, fallback: number, min: number, max: number) {
  const n = raw;
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n as number));
}
