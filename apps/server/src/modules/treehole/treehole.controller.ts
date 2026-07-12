import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { Public } from '../auth/public.decorator';
import { AnonGuard } from './anon.guard';
import { TreeholeService } from './treehole.service';
import { CreateAnonPostDto } from './dto/create-anon-post.dto';

@Controller('treehole')
export class TreeholeController {
  constructor(private readonly treehole: TreeholeService) {}

  // 换匿名 token：需登录（access token），返回 anonToken（不含 uid）
  @Post('anonymous-token')
  async anonymousToken(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.getAnonymousToken(uid));
  }

  // 以下接口用 anonToken 鉴权（@Public 跳过 JwtAuthGuard + @UseGuards(AnonGuard)）

  @Public()
  @UseGuards(AnonGuard)
  @Post('posts')
  async createPost(@Body() dto: CreateAnonPostDto, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.treehole.createPost(anonId, dto));
  }

  @Public()
  @UseGuards(AnonGuard)
  @Get('posts')
  async listPosts(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return ok(await this.treehole.listPosts(cursor, limit ? Number(limit) : undefined));
  }

  @Public()
  @UseGuards(AnonGuard)
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
}
