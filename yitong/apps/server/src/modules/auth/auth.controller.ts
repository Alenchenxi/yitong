import { Body, Controller, Delete, Get, HttpStatus, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { WxLoginDto } from './dto/wx-login.dto';
import { Public } from './public.decorator';
import type { AuthenticatedRequest } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 登录 5/min（API 规范 §8）
  @Post('wx-login')
  async wxLogin(@Body() dto: WxLoginDto) {
    return ok(await this.auth.wxLogin(dto));
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 刷新 5/min
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

  // 账号资料：昵称 / 性别 / 生日
  @Get('account')
  async getAccount(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.auth.getAccount(uid));
  }

  @Put('account')
  async updateAccount(@Body() dto: UpdateAccountDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.auth.updateAccount(uid, dto));
  }

  // 注销账号（soft delete）
  @Delete('account')
  async deleteAccount(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    await this.auth.deleteAccount(uid);
    return ok({ deleted: true });
  }
}
