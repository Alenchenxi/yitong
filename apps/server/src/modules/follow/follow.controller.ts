import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { FollowListQueryDto } from './dto/follow-list-query.dto';
import { FollowService } from './follow.service';

@Controller('users')
export class FollowController {
  constructor(private readonly follow: FollowService) {}

  // ===== 静态段路由（me）— 必须排在 :id 动态段前，否则被 :id 捕走 =====
  // P1-09 我的关注列表
  @Get('me/following')
  async myFollowing(@Req() req: Request, @Query() q: FollowListQueryDto) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.follow.listFollowing(uid, q.page ?? 1, q.pageSize ?? 30));
  }

  // P1-09 我的粉丝列表
  @Get('me/followers')
  async myFollowers(@Req() req: Request, @Query() q: FollowListQueryDto) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.follow.listFollowers(uid, q.page ?? 1, q.pageSize ?? 30));
  }

  // ===== 动态段路由 =====
  // 关注/取关 toggle
  @Post(':id/follow')
  async toggle(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.follow.toggle(uid, id));
  }

  // 查关注状态
  @Get(':id/following')
  async isFollowing(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.follow.isFollowing(uid, id));
  }

  // P1-09 指定用户的关注列表
  @Get(':id/follow-list')
  async userFollowing(@Param('id') id: string, @Query() q: FollowListQueryDto) {
    return ok(await this.follow.listFollowing(id, q.page ?? 1, q.pageSize ?? 30));
  }

  // P1-09 指定用户的粉丝列表
  @Get(':id/follower-list')
  async userFollowers(@Param('id') id: string, @Query() q: FollowListQueryDto) {
    return ok(await this.follow.listFollowers(id, q.page ?? 1, q.pageSize ?? 30));
  }
}
