import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { WxLoginDto } from './dto/wx-login.dto';
import { Public } from './public.decorator';
import type { AuthenticatedRequest } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('wx-login')
  async wxLogin(@Body() dto: WxLoginDto) {
    const data = await this.auth.wxLogin(dto);
    return ok(data);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const data = await this.auth.refresh(dto.refreshToken);
    return ok(data);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid;
    if (!uid) throw new BizException(10001, '未登录', HttpStatus.UNAUTHORIZED);
    const data = await this.auth.getMe(uid);
    return ok(data);
  }
}
