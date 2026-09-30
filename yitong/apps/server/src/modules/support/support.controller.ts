import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // P2-19 薪资保障规则（静态段必须排在 tickets/:id 之前）
  @Get('salary-guarantee')
  async salaryGuarantee() {
    return ok(this.support.getSalaryGuaranteeRules());
  }

  // P2-17 商家账单
  @Get('merchant/orders')
  async listMerchantOrders(@Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.support.listMerchantOrders(u.uid));
  }

  // P2-20 创建工单（用户/商家均可）
  @Post('tickets')
  async createTicket(
    @Body() body: { title?: string; content?: string; role?: string },
    @Req() req: Request,
  ) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.support.createTicket(u.uid, body.role === 'merchant' ? 'merchant' : 'user', body.title ?? '', body.content ?? ''));
  }

  @Get('tickets')
  async listMyTickets(@Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.support.listMyTickets(u.uid));
  }

  @Get('tickets/:id')
  async getTicket(@Param('id') id: string, @Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.support.getTicket(u.uid, id));
  }
}
