import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { AdminGuard } from '../auth/admin.guard';
import { DashboardService } from './dashboard.service';
import { AdminService } from './admin.service';
import { BatchMerchantDto } from './dto/batch-merchant.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { Body, Param, Post, Put, UseGuards } from '@nestjs/common';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('queue')
  async queue() {
    return ok(await this.admin.getQueue());
  }

  @Get('stats')
  async stats() {
    return ok(await this.dashboard.getStats());
  }

  @Post('merchants/:id/approve')
  async approveMerchant(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.approveMerchant(id, uid, reason));
  }

  @Post('merchants/:id/reject')
  async rejectMerchant(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.rejectMerchant(id, uid, reason));
  }

  @Post('merchants/batch')
  async batchMerchants(@Body() dto: BatchMerchantDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.batchMerchants(dto.ids, dto.action, uid, dto.reason));
  }

  @Post('posts/:id/takedown')
  async takedownPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.takedownPost(id, uid, reason));
  }

  @Post('anon-posts/:id/takedown')
  async takedownAnonPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.takedownAnonPost(id, uid, reason));
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
