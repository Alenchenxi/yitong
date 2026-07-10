import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { WxLoginDto } from './dto/wx-login.dto';
import { Public } from './public.decorator';
import type { AuthenticatedRequest } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('wx-login')
  async wxLogin(@Body() dto: WxLoginDto) {
    return ok(await this.auth.wxLogin(dto));
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return ok(await this.auth.refresh(dto.refreshToken));
  }

  @Get('me')
  async me(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    return ok(await this.auth.getMe(uid));
  }

  // 静默切换角色：需登录（Bearer），body { role }，返回新 token
  @Post('switch-role')
  async switchRole(@Body() dto: SwitchRoleDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    return ok(await this.auth.switchRole(uid, dto.role));
  }
}
