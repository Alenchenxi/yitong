import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/types';

interface AnonTokenPayload {
  anonId: string;
  type: string;
}

// 匿名态守卫：校验 anonToken（type=anon，含 anonId 不含 uid），把 anonId 挂到 req.user.uid。
// 树洞接口用 @Public() 跳过全局 JwtAuthGuard + @UseGuards(AnonGuard) 单独校验 anonToken。
// 红线：anonToken 不含真实 uid，树洞接口拿不到 uid，只能拿 anonId。
@Injectable()
export class AnonGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const raw = req.headers['authorization'];
    const auth = typeof raw === 'string' ? raw : '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      throw new BizException(30001, '匿名态失效，请重新获取', HttpStatus.UNAUTHORIZED);
    }
    try {
      const payload = await this.jwt.verifyAsync<AnonTokenPayload>(token);
      if (payload.type !== 'anon' || !payload.anonId) {
        throw new BizException(30001, '匿名态失效', HttpStatus.UNAUTHORIZED);
      }
      if (this.isLegacyUnsafeAnonId(payload.anonId)) {
        throw new BizException(30001, '匿名态已升级，请重新获取', HttpStatus.UNAUTHORIZED);
      }
      const profile = await this.prisma.anonymousProfile.findUnique({
        where: { anonId: payload.anonId },
        select: { id: true },
      });
      if (!profile) {
        throw new BizException(30001, '匿名态失效，请重新获取', HttpStatus.UNAUTHORIZED);
      }
      // 把 anonId 放到 uid 字段供 treehole service 使用（不含真实 uid）
      req.user = { uid: payload.anonId, role: '', openid: '', type: 'anon' };
      return true;
    } catch (e) {
      if (e instanceof BizException) throw e;
      throw new BizException(30001, '匿名态失效，请重新获取', HttpStatus.UNAUTHORIZED);
    }
  }

  private isLegacyUnsafeAnonId(anonId: string): boolean {
    return /^anon_[^_]{1,6}_[^_]+$/.test(anonId);
  }
}
