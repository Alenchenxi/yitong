import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { CommunityService } from './community.service';
import { CreateCommunityDto, SwitchCommunityDto } from './dto/community.dto';

// 圈子（Community）CRUD / 加入/切换
// 鉴权：全局 JwtAuthGuard（access token）；静态路由（list/mine/active/switch）先于 :id 注册
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('list')
  async list(@Req() req: AuthenticatedRequest, @Query('category') category?: string) {
    return ok(await this.community.listPublic(req.user!.uid, category || undefined));
  }

  // 圈子搜索（静态路由先于 :id）
  @Get('search')
  async search(@Req() req: AuthenticatedRequest, @Query('keyword') keyword: string) {
    return ok(await this.community.search(req.user!.uid, keyword ?? ''));
  }

  @Get('mine')
  async mine(@Req() req: AuthenticatedRequest) {
    return ok(await this.community.listMine(req.user!.uid));
  }

  // 广场启动引导：惰性确保的当前圈子
  @Get('active')
  async active(@Req() req: AuthenticatedRequest) {
    return ok(await this.community.getActive(req.user!.uid));
  }

  @Get(':id')
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.community.detail(req.user!.uid, id));
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 3 } }) // 建圈 3/min（API 规范 §8）
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCommunityDto) {
    return ok(await this.community.create(req.user!.uid, dto, req.user!.openid));
  }

  @Post(':id/join')
  async join(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.community.join(req.user!.uid, id));
  }

  @Post(':id/leave')
  async leave(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.community.leave(req.user!.uid, id));
  }

  @Post('switch')
  async switchActive(@Req() req: AuthenticatedRequest, @Body() dto: SwitchCommunityDto) {
    return ok(await this.community.switchActive(req.user!.uid, dto.communityId));
  }
}
