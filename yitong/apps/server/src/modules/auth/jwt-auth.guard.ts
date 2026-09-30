import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest, JwtPayload } from './types';

// 全局 JWT 守卫：@Public() 接口放行；其余校验 Bearer token 并挂载 req.user
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const raw = req.headers['authorization'];
    const auth = typeof raw === 'string' ? raw : '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new BizException(10002, '登录已过期，请重新登录', HttpStatus.UNAUTHORIZED);
    }
    // 仅允许 access token 访问受保护接口，禁止 refresh token 互换使用
    if (payload.type !== 'access') {
      throw new BizException(10002, 'token 类型不正确', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.uid },
      select: { deletedAt: true },
    });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.UNAUTHORIZED);
    if (user.deletedAt) throw new BizException(10005, '账号已被封禁', HttpStatus.FORBIDDEN);
    req.user = payload;
    return true;
  }
}
