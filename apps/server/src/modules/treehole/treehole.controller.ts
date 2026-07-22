import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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

  // P1-13 标签库：按 category 分组返回 active 标签（公开，前端 chips 用）
  @Public()
  @Get('tags')
  async listTags() {
    return ok(await this.treehole.listTags());
  }

  // P1-14 问卷题库（公开）
  @Public()
  @Get('questionnaire')
  async getQuestionnaire(@Query('type') type: string) {
    return ok(this.treehole.getQuestionnaire(type));
  }

  // P1-14 提交问卷（access token；结果入画像）
  @Post('questionnaire/submit')
  async submitQuestionnaire(
    @Body() dto: { type?: string; answers?: { questionId: string; optionId: string }[] },
    @Req() req: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.submitQuestionnaire(uid, dto.type ?? '', dto.answers ?? []));
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

  // P1-16 匹配历史列表
  @Public()
  @UseGuards(AnonGuard)
  @Get('matches')
  async listMatches(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: Request,
  ) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(
      await this.treehole.listMatches(
        anonId,
        parsePositiveInt(page, 1, 1, 1000),
        parsePositiveInt(pageSize, 20, 1, 50),
      ),
    );
  }

  // P1-16 跳过/不喜欢当前匹配 + 重新匹配
  @Public()
  @UseGuards(AnonGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('matches/:id/skip')
  async skipMatch(@Param('id') id: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.skipMatch(anonId, id));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Post('party/join')
  async joinParty(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.joinParty(anonId));
  }

  // ===== P2-07~P2-09 树洞群聊 =====
  @Public()
  @UseGuards(AnonGuard)
  @Post('groups')
  async createGroup(
    @Body() dto: {
      name?: string;
      avatarUrl?: string;
      description?: string;
      tags?: string[];
      announcement?: string;
      maxMembers?: number;
      isPrivate?: boolean;
    },
    @Req() req: Request,
  ) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.createGroup(anonId, dto as { name: string; avatarUrl?: string; description?: string; tags?: string[]; announcement?: string; maxMembers?: number; isPrivate?: boolean }));
  }

  // P2-07 群聊广场
  @Public()
  @UseGuards(AnonGuard)
  @Get('groups')
  async listGroups(
    @Query('sort') sort: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: Request,
  ) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.listGroups(anonId, { sort, tag, limit: limit ? Number(limit) : undefined }));
  }

  // P2-14 我的群聊（静态段必须排在 groups/:id 之前）
  @Public()
  @UseGuards(AnonGuard)
  @Get('groups/mine')
  async listMyGroups(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.listMyGroups(anonId));
  }

  // P2-09 群聊详情
  @Public()
  @UseGuards(AnonGuard)
  @Get('groups/:id')
  async getGroup(@Param('id') id: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.getGroup(anonId, id));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Post('groups/:id/join')
  async joinGroup(@Param('id') id: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.joinGroup(anonId, id));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Post('groups/:id/leave')
  async leaveGroup(@Param('id') id: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.leaveGroup(anonId, id));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Post('messages')
  async sendMessage(
    @Body() dto: { peerAnonId?: string; content?: string; type?: string; duration?: number },
    @Req() req: Request,
  ) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(
      await this.treehole.sendMessage(anonId, dto.peerAnonId ?? '', dto.content ?? '', dto.type, dto.duration),
    );
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

  // P0-16 黑名单/屏蔽：blocker 屏蔽 blocked（anonToken 鉴权），互相隔离广场/匹配/聊天
  @Public()
  @UseGuards(AnonGuard)
  @Post('blocks')
  async block(@Body() dto: { blockedAnonId?: string }, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.block(anonId, dto.blockedAnonId ?? ''));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Delete('blocks/:blockedAnonId')
  async unblock(@Param('blockedAnonId') blockedAnonId: string, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.unblock(anonId, blockedAnonId));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Get('blocks')
  async listBlocks(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.listBlocks(anonId));
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
