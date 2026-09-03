import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BizException } from '../../common/exceptions/biz.exception';
import {
  ADMIN_ALLOW_ANY_KEY,
  ADMIN_PERMISSION_KEY,
} from '../admin/admin-access.decorator';
import { AdminAccessService } from '../admin/admin-access.service';
import type { AdminPermissionCode } from '../admin/admin-permissions';
import { ADMIN_PERMISSIONS } from '../admin/admin-permissions';
import type { AuthenticatedRequest } from './types';

// 管理员守卫：在 JwtAuthGuard 之后执行，校验 req.user.role === 'ADMIN'。
// 用法：@UseGuards(AdminGuard) 加在 controller/method 上。
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AdminAccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.user?.role !== 'ADMIN') {
      throw new BizException(10003, '无管理员权限', HttpStatus.FORBIDDEN);
    }
    const access = await this.accessService.resolve(req.user.openid);
    if (!access) {
      throw new BizException(10003, '管理员账号或管理员类型已停用', HttpStatus.FORBIDDEN);
    }
    req.adminAccess = access;
    const allowAny = this.reflector.getAllAndOverride<boolean>(ADMIN_ALLOW_ANY_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowAny) return true;
    const required = this.reflector.getAllAndOverride<AdminPermissionCode[]>(
      ADMIN_PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (access.isPlatform) return true;
    if (required?.some((code) =>
      code === ADMIN_PERMISSIONS.ADMIN_MANAGE
      || code === ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE
    )) {
      throw new BizException(10003, '仅平台管理员可管理管理员权限', HttpStatus.FORBIDDEN);
    }
    if (!required?.length || !required.every((code) => access.permissions.includes(code))) {
      throw new BizException(10003, '无此管理功能权限', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
