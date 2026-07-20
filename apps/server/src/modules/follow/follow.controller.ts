import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { FollowService } from './follow.service';

@Controller('users')
export class FollowController {
  constructor(private readonly follow: FollowService) {}

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
}
