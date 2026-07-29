import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { MerchantService } from './merchant.service';
import { BatchMarkDto, ListCandidatesDto, ListViewersDto, MarkContactedDto, MarkFitDto } from './dto/list-candidates.dto';
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

  @Get('reviews')
  async reviews(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.getMerchantReviews(uid));
  }

  // M2-01 跨岗位候选人聚合（岗位 / 状态 / 关键词筛选 + 分页）
  @Get('candidates')
  async candidates(@Query() dto: ListCandidatesDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.listCandidates(uid, dto));
  }

  // M2-03 看过我列表（基于 JobView，可按岗位过滤 + 分页）
  @Get('viewers')
  async viewers(@Query() dto: ListViewersDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.listViewers(uid, dto));
  }

  // M2-04 标记/取消 已联系
  @Post('candidates/:id/contact')
  async markContacted(@Param('id') id: string, @Body() dto: MarkContactedDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.markContacted(uid, id, dto));
  }

  // M2-05 标记/取消 合适·不合适（fitMark=null 清除）
  @Post('candidates/:id/fit')
  async markFit(@Param('id') id: string, @Body() dto: MarkFitDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.markFit(uid, id, dto));
  }

  // M2-06 批量标记已联系 / 合适度
  @Post('candidates/batch-mark')
  async batchMark(@Body() dto: BatchMarkDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.batchMark(uid, dto));
  }

  // M2-07 候选人详情：简历 + 报名问题 + 岗位 + 处理记录（时间线）
  @Get('candidates/:id')
  async candidateDetail(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.getCandidateDetail(uid, id));
  }

  @Get('orders')
  async orders(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.merchant.getMerchantOrders(uid));
  }
}
