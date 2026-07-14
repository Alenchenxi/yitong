import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { ReferralService } from './referral.service';

@Controller('referrals')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  // 取我的邀请码（不存在则生成）
  @Get('my-code')
  async myCode(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.referral.getMyCode(uid));
  }

  // 我邀请的人数 + 列表
  @Get('my-stats')
  async myStats(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.referral.getMyStats(uid));
  }
}