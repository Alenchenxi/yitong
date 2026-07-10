import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { MerchantService } from './merchant.service';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchant: MerchantService) {}

  @Post('register')
  async register(@Body() dto: RegisterMerchantDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.register(uid, dto));
  }

  @Get('profile')
  async profile(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.getProfile(uid));
  }

  @Put('profile')
  async update(@Body() dto: UpdateMerchantDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.updateProfile(uid, dto));
  }
}
