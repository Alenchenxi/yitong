import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { Public } from '../auth/public.decorator';
import { AnonGuard } from './anon.guard';
import { TreeholeService } from './treehole.service';
import { CreateAnonPostDto } from './dto/create-anon-post.dto';
import { UpdateAnonProfileDto } from './dto/update-anon-profile.dto';

@Controller('treehole')
export class TreeholeController {
  constructor(private readonly treehole: TreeholeService) {}

  // 换匿名 token：需登录（access token），返回 anonToken（不含 uid）
  @Post('anonymous-token')
  async anonymousToken(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.getAnonymousToken(uid));
  }

  // P0-12 匿名身份资料：用 access token（uid），get/update（AnonymousProfile 后台可追溯）
  @Get('profile')
  async getProfile(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.getProfile(uid));
  }

  @Put('profile')
  async updateProfile(@Body() dto: UpdateAnonProfileDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.updateProfile(uid, dto));
  }

  // 以下接口用 anonToken 鉴权（@Public 跳过 JwtAuthGuard + @UseGuards(AnonGuard)）

  @Public()
  @UseGuards(AnonGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 匿名发帖 5/min
  @Post('posts')
  async createPost(@Body() dto: CreateAnonPostDto, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.createPost(anonId, dto));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Get('posts')
  async listPosts(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('mood') mood?: string,
    @Req() req?: Request,
  ) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(
      await this.treehole.listPosts(anonId, {
        cursor,
        limit: parsePositiveInt(limit, 20, 1, 50),
        sort: sort === 'recommend' ? 'recommend' : 'latest',
        mood,
      }),
    );
  }

  // 我的匿名帖：用 access token（非 anon），按 userId -> anonId 查
  @Get('posts/mine')
  async myPosts(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.listMyAnonPosts(uid));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Get('posts/:id')
  async getPost(@Param('id') id: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.getPost(anonId, id));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('posts/:id/like')
  async toggleLike(@Param('id') id: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.toggleAnonPostLike(anonId, id));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 匹配 10/min（API 规范 §8）
  @Post('match')
  async match(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.match(anonId));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Post('party/join')
  async joinParty(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.joinParty(anonId));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Post('messages')
  async sendMessage(@Body() dto: { peerAnonId?: string; content?: string }, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.sendMessage(anonId, dto.peerAnonId ?? '', dto.content ?? ''));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Get('messages')
  async listMessages(
    @Query('peerAnonId') peerAnonId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.listMessages(anonId, peerAnonId, cursor, parsePositiveInt(limit, 50, 1, 100)));
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
