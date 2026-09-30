import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BizException } from '../common/exceptions/biz.exception';
import { LicenseService } from './license.service';
import {
  LICENSE_DISABLED_CODE,
  LICENSE_DISABLED_MSG,
  LICENSE_DISABLED_STATUS,
  LICENSE_PUBLIC_KEY,
} from './license.constants';

// 全局授权守卫：未通过授权 -> 90003/503 阻断所有路由（在 app.module 中排在 Throttler/Jwt 前）
// @LicensePublic() 路由放行（status / refresh）；未配置授权（dev）放行
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(
    private readonly license: LicenseService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(LICENSE_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    if (this.license.isAllowed()) return true;
    throw new BizException(LICENSE_DISABLED_CODE, LICENSE_DISABLED_MSG, LICENSE_DISABLED_STATUS);
  }
}
