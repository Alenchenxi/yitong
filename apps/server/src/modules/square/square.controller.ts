import { Controller, Get, Headers, Query, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { SquareService } from './square.service';
import { SquareFeedQueryDto, SquareTodayHitQueryDto } from './dto';

// anon token payload（与 treehole/anon.guard.ts AnonTokenPayload 一致：含 anonId 不含真实 uid）
interface AnonTokenPayload {
  anonId: string;
  type: string;
}

// CR-001 广场混合流（扩展为圈子广场数据模块）：union feed / 今日上头 / 广告位
// 鉴权：JwtAuthGuard 强制 access token（全局 APP_GUARD），x-anon-token 可选解析 anonId
@Controller('square')
export class SquareController {
  constructor(
    private readonly square: SquareService,
    private readonly jwt: JwtService,
  ) {}

  @Get('feed')
  async feed(
    @Req() req: AuthenticatedRequest,
    @Query() q: SquareFeedQueryDto,
    @Headers('x-anon-token') anonToken?: string,
  ) {
    const uid = req.user!.uid;
    const anonId = this.parseAnonId(anonToken);
    return ok(await this.square.feed(uid, anonId, q));
  }

  // 今日上头：近24h 浏览量 TopN（表白墙帖 + 树洞帖）
  @Get('today-hit')
  async todayHit(
    @Req() req: AuthenticatedRequest,
    @Query() q: SquareTodayHitQueryDto,
    @Headers('x-anon-token') anonToken?: string,
  ) {
    const uid = req.user!.uid;
    const anonId = this.parseAnonId(anonToken);
    return ok(await this.square.todayHit(uid, anonId, q));
  }

  // 广告位 Banner（圈子 + 全局轮播）
  @Get('banners')
  async banners(@Req() req: AuthenticatedRequest, @Query('communityId') communityId?: string) {
    const uid = req.user!.uid;
    return ok(await this.square.banners(uid, communityId));
  }

  // 从 x-anon-token 解析 anonId；无效/过期/非 anon 类型统一返回 null（匿名帖仍展示，liked=false）
  // 红线：仅返回 anonId，不返回任何真实身份字段
  private parseAnonId(token?: string): string | null {
    if (!token || typeof token !== 'string') return null;
    try {
      const payload = this.jwt.verify<AnonTokenPayload>(token);
      if (payload.type !== 'anon' || !payload.anonId) return null;
      return payload.anonId;
    } catch {
      return null;
    }
  }
}
