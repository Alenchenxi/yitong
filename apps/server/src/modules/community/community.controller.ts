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

  // P2-26 creator 视角分桶（我加入/待审核/未通过），mine 静态路由先于 :id
  @Get('mine/all')
  async mineAll(@Req() req: AuthenticatedRequest) {
    return ok(await this.community.listMineAll(req.user!.uid));
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

  // 好友分享邀请：幂等加入；已是圈友时只切换当前圈子
  @Post(':id/invite-join')
  async acceptInvite(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.community.acceptInvite(req.user!.uid, id));
  }

  @Post(':id/leave')
  async leave(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.community.leave(req.user!.uid, id));
  }

  @Post('switch')
  async switchActive(@Req() req: AuthenticatedRequest, @Body() dto: SwitchCommunityDto) {
    return ok(await this.community.switchActive(req.user!.uid, dto.communityId));
  }

  // P2-26 creator 自己重提被拒圈（5/min 比创建宽）
  @Post(':id/resubmit')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async resubmit(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.community.resubmit(id, req.user!.uid));
  }
}
