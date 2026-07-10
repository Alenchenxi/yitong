import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';
import type { AuthenticatedRequest } from './types';

// 管理员守卫：在 JwtAuthGuard 之后执行，校验 req.user.role === 'ADMIN'。
// 用法：@UseGuards(AdminGuard) 加在 controller/method 上。
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.user?.role !== 'ADMIN') {
      throw new BizException(10003, '无管理员权限', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
