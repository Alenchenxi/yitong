import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MatchStatus } from '@prisma/client';
import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { PrismaService } from '../../prisma/prisma.service';

interface WsLoginPayload {
  identifier: string;
  type: 'ws';
}

interface ClientMsg {
  type: 'login' | 'msg' | 'join' | 'leave' | 'room-msg' | 'ping';
  loginUserId?: string;
  loginToken?: string;
  toId?: string;
  roomId?: string;
  content?: string;
  msgType?: string; // P0-14 消息内容类型 text / image；P1-18 + voice
  duration?: number; // P1-18 语音时长（秒），仅 msgType=voice
}

interface ConnMeta {
  identifier: string;
  alive: boolean;
}

// 自建 WebSocket 聊天网关：
// - 连接鉴权（login + JWT 校验，identifier = uid 或 anonId）
// - 1v1 消息转发（msg -> toId 在线连接）
// - 房间原语（join/leave/room-msg 广播），供树洞派对房 + 1v1 复用
// - 心跳（ping/pong + 30s 超时踢）
// 消息持久化由 ChatService（HTTP）负责，网关只管实时转发；离线消息靠历史接口拉取。
@Injectable()
export class ChatGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private server!: WebSocketServer;
  private readonly conns = new Map<string, Set<WebSocket>>(); // identifier -> 在线连接（多端）
  private readonly rooms = new Map<string, Set<string>>(); // roomId -> identifier 集合
  private readonly meta = new WeakMap<WebSocket, ConnMeta>();
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const port = Number(this.config.get<string>('CHAT_WS_PORT')) || 3001;
    this.server = new WebSocketServer({ port });
    this.server.on('connection', (ws, req) => this.onConnection(ws, req));
    this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), 30_000);
    this.logger.log(`ChatGateway ws server on :${port}`);
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.server?.close();
  }

  private onConnection(ws: WebSocket, _req: IncomingMessage) {
    this.meta.set(ws, { identifier: '', alive: true });
    ws.on('message', (raw) => this.onMessage(ws, raw.toString()));
    ws.on('close', () => this.onClose(ws));
    ws.on('error', () => this.onClose(ws));
    this.send(ws, { type: 'hello' });
  }

  private async onMessage(ws: WebSocket, raw: string) {
    let m: ClientMsg;
    try {
      m = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }
    switch (m.type) {
      case 'login':
        await this.handleLogin(ws, m);
        break;
      case 'ping':
        this.setAlive(ws, true);
        this.send(ws, { type: 'pong' });
        break;
      case 'msg':
        void this.handleMsg(ws, m);
        break;
      case 'join':
        void this.handleJoin(ws, m);
        break;
      case 'leave':
        this.handleLeave(ws, m);
        break;
      case 'room-msg':
        void this.handleRoomMsg(ws, m);
        break;
    }
  }

  private async handleLogin(ws: WebSocket, m: ClientMsg) {
    const identifier = m.loginUserId ?? '';
    const token = m.loginToken ?? '';
    if (!identifier || !token) {
      this.send(ws, { type: 'login_failed', reason: 'missing' });
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<WsLoginPayload>(token);
      if (payload.identifier !== identifier || payload.type !== 'ws') {
        this.send(ws, { type: 'login_failed', reason: 'invalid' });
        return;
      }
    } catch {
      this.send(ws, { type: 'login_failed', reason: 'token' });
      return;
    }
    this.meta.set(ws, { identifier, alive: true });
    if (!this.conns.has(identifier)) this.conns.set(identifier, new Set());
    this.conns.get(identifier)!.add(ws);
    this.send(ws, { type: 'login_ok', loginUserId: identifier });
  }

  private async handleMsg(ws: WebSocket, m: ClientMsg) {
    const from = this.meta.get(ws)?.identifier ?? '';
    if (!from || !m.toId || m.content == null) return;
    let allowed = false;
    try {
      allowed = await this.canSendDirectMessage(from, m.toId);
    } catch (e) {
      this.logger.error(`direct message auth check failed: ${(e as Error).message}`);
      this.send(ws, { type: 'msg_failed', toId: m.toId, reason: 'auth_check_failed' });
      return;
    }
    if (!allowed) {
      this.send(ws, { type: 'msg_failed', toId: m.toId, reason: 'not_matched' });
      return;
    }
    const ts = Date.now();
    this.forward(m.toId, {
      type: 'msg',
      fromId: from,
      toId: m.toId,
      content: m.content,
      msgType: m.msgType,
      duration: m.duration,
      ts,
    });
    // 回执给发送方（已转发）
    this.send(ws, {
      type: 'msg_sent',
      toId: m.toId,
      content: m.content,
      msgType: m.msgType,
      duration: m.duration,
      ts,
    });
  }

  private async handleJoin(ws: WebSocket, m: ClientMsg) {
    const id = this.meta.get(ws)?.identifier ?? '';
    if (!id || !m.roomId) return;
    if (!(await this.canJoinRoom(m.roomId, id))) {
      this.send(ws, { type: 'join_failed', roomId: m.roomId, reason: 'invalid_room' });
      return;
    }
    if (!this.rooms.has(m.roomId)) this.rooms.set(m.roomId, new Set());
    this.rooms.get(m.roomId)!.add(id);
    this.send(ws, { type: 'joined', roomId: m.roomId });
    this.broadcastRoom(m.roomId, { type: 'room_event', roomId: m.roomId, event: 'join', memberId: id }, id);
  }

  private handleLeave(ws: WebSocket, m: ClientMsg) {
    const id = this.meta.get(ws)?.identifier ?? '';
    if (!id || !m.roomId) return;
    this.rooms.get(m.roomId)?.delete(id);
    this.send(ws, { type: 'left', roomId: m.roomId });
    this.broadcastRoom(m.roomId, { type: 'room_event', roomId: m.roomId, event: 'leave', memberId: id });
  }

  private async handleRoomMsg(ws: WebSocket, m: ClientMsg) {
    const id = this.meta.get(ws)?.identifier ?? '';
    if (!id || !m.roomId || m.content == null) return;
    if (!(await this.canJoinRoom(m.roomId, id))) return;
    if (!this.rooms.get(m.roomId)?.has(id)) return; // 未加入房间不能发
    this.broadcastRoom(
      m.roomId,
      {
        type: 'room-msg',
        roomId: m.roomId,
        fromId: id,
        content: m.content,
        msgType: m.msgType,
        ts: Date.now(),
      },
      id,
    ); // 排除发送方，不回发给自己
  }

  private onClose(ws: WebSocket) {
    const id = this.meta.get(ws)?.identifier ?? '';
    this.meta.delete(ws);
    if (!id) return;
    const set = this.conns.get(id);
    set?.delete(ws);
    if (set && set.size === 0) {
      this.conns.delete(id);
      // 从所有房间移除并广播
      for (const [rid, members] of this.rooms) {
        if (members.delete(id)) {
          this.broadcastRoom(rid, { type: 'room_event', roomId: rid, event: 'leave', memberId: id });
        }
      }
    }
  }

  private forward(identifier: string, payload: unknown) {
    const set = this.conns.get(identifier);
    if (!set) return; // 离线：丢弃实时帧，靠 HTTP 历史拉取
    for (const c of set) this.send(c, payload);
  }

  private broadcastRoom(roomId: string, payload: unknown, exclude?: string) {
    const members = this.rooms.get(roomId);
    if (!members) return;
    for (const id of members) {
      if (id === exclude) continue;
      this.forward(id, payload);
    }
  }

  private send(ws: WebSocket, payload: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }

  private setAlive(ws: WebSocket, v: boolean) {
    const mt = this.meta.get(ws);
    if (mt) mt.alive = v;
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
    // P0-16 屏蔽双向隔离（网关级，防恶意客户端绕过 HTTP 直发 WS）
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

  // P2-11 群 room：'group:'+groupId，校验成员关系；派对房直接允许
  private async canJoinRoom(roomId: string, id: string): Promise<boolean> {
    if (roomId === 'treehole-party-main') return true;
    if (roomId.startsWith('group:')) {
      const groupId = roomId.slice(6);
      const member = await this.prisma.anonGroupMember.findUnique({
        where: { groupId_anonId: { groupId, anonId: id } },
        select: { id: true },
      });
      return !!member;
    }
    return false;
  }

  private checkHeartbeat() {
    for (const ws of this.server.clients) {
      const mt = this.meta.get(ws);
      if (!mt) continue;
      if (!mt.alive) {
        ws.terminate();
        continue;
      }
      mt.alive = false; // 本轮重置，等下次 ping 置 true
    }
  }
}
