import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import { AdminGuard } from '../auth/admin.guard';
import type { AuthenticatedRequest } from '../auth/types';
import { AdminService } from './admin.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';

// 管理员接口：全局 JwtAuthGuard 校验 access token + @UseGuards(AdminGuard) 校验 role=ADMIN
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('queue')
  async queue() {
    return ok(await this.admin.getQueue());
  }

  @Post('merchants/:id/approve')
  async approveMerchant(@Param('id') id: string) {
    return ok(await this.admin.approveMerchant(id));
  }

  @Post('merchants/:id/reject')
  async rejectMerchant(@Param('id') id: string) {
    return ok(await this.admin.rejectMerchant(id));
  }

  @Post('posts/:id/takedown')
  async takedownPost(@Param('id') id: string) {
    return ok(await this.admin.takedownPost(id));
  }

  @Post('anon-posts/:id/takedown')
  async takedownAnonPost(@Param('id') id: string) {
    return ok(await this.admin.takedownAnonPost(id));
  }

  @Get('pricing')
  async getPricing() {
    return ok(await this.admin.getPricing());
  }

  @Put('pricing')
  async updatePricing(@Body() dto: UpdatePricingDto) {
    return ok(await this.admin.updatePricing(dto));
  }

  @Post('users/:id/ban')
  async banUser(@Param('id') id: string) {
    return ok(await this.admin.banUser(id));
  }
}
