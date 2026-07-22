import { Controller, Get, Req, Query, Delete } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { AdminGuard } from '../auth/admin.guard';
import { DashboardService } from './dashboard.service';
import { AdminService } from './admin.service';
import { BatchMerchantDto } from './dto/batch-merchant.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { CreateAnonTagDto, UpdateAnonTagDto } from './dto/anon-tag.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
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

  // P1-28 举报处理队列
  @Get('reports')
  async listReports(@Query('status') status?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return ok(
      await this.admin.listReports(status, Math.max(1, Number(page) || 1), Math.min(100, Math.max(1, Number(pageSize) || 20))),
    );
  }

  @Post('reports/:id/resolve')
  async resolveReport(@Param('id') id: string, @Body() dto: ResolveReportDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.resolveReport(id, uid, dto));
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

  // P2-05 帖子置顶/取消置顶
  @Post('posts/:id/pin')
  async pinPost(@Param('id') id: string, @Body() body: { pinned?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.pinPost(id, uid, body?.pinned !== false, (req.body as { reason?: string })?.reason));
  }

  // P2-05 帖子加精/取消加精
  @Post('posts/:id/feature')
  async featurePost(@Param('id') id: string, @Body() body: { featured?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.featurePost(id, uid, body?.featured !== false, (req.body as { reason?: string })?.reason));
  }

  // P2-15 兼职精品 toggle
  @Post('job-posts/:id/feature')
  async featureJob(@Param('id') id: string, @Body() body: { featured?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.featureJob(id, uid, body?.featured !== false));
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

  // P1-12 禁言（body { days?: number }；不传或 0 = 解除）
  @Post('users/:id/mute')
  async muteUser(@Param('id') id: string, @Body() body: { days?: number }) {
    return ok(await this.admin.muteUser(id, body?.days));
  }

  // ===== P1-13 树洞标签库管理 =====
  @Get('anon-tags')
  async listAnonTags(@Query('category') category?: string) {
    return ok(await this.admin.listAnonTags(category));
  }

  @Post('anon-tags')
  async createAnonTag(@Body() dto: CreateAnonTagDto) {
    return ok(await this.admin.createAnonTag(dto));
  }

  @Put('anon-tags/:id')
  async updateAnonTag(@Param('id') id: string, @Body() dto: UpdateAnonTagDto) {
    return ok(await this.admin.updateAnonTag(id, dto));
  }

  @Delete('anon-tags/:id')
  async deleteAnonTag(@Param('id') id: string) {
    return ok(await this.admin.deleteAnonTag(id));
  }

  // ===== P2-03 活动专题管理 =====
  @Post('activity-topics')
  async createActivityTopic(@Body() body: { title: string; coverUrl?: string; description?: string; status?: string; sortOrder?: number }) {
    return ok(await this.admin.createActivityTopic(body));
  }
  @Put('activity-topics/:id')
  async updateActivityTopic(@Param('id') id: string, @Body() body: Partial<{ title: string; coverUrl: string | null; description: string | null; status: string; sortOrder: number }>) {
    return ok(await this.admin.updateActivityTopic(id, body));
  }
  @Delete('activity-topics/:id')
  async deleteActivityTopic(@Param('id') id: string) {
    return ok(await this.admin.deleteActivityTopic(id));
  }
  @Post('activity-topics/:id/posts')
  async addTopicPost(@Param('id') id: string, @Body() body: { postId: string; sortOrder?: number }) {
    return ok(await this.admin.addTopicPost(id, body.postId, body.sortOrder ?? 0));
  }
  @Delete('activity-topics/:id/posts/:postId')
  async removeTopicPost(@Param('id') id: string, @Param('postId') postId: string) {
    return ok(await this.admin.removeTopicPost(id, postId));
  }

  // ===== P2-04 话题管理 =====
  @Post('topics')
  async createTopic(@Body() body: { name: string; description?: string; coverUrl?: string; status?: string; sortOrder?: number }) {
    return ok(await this.admin.createTopic(body));
  }
  @Put('topics/:id')
  async updateTopic(@Param('id') id: string, @Body() body: Partial<{ name: string; description: string | null; coverUrl: string | null; status: string; sortOrder: number }>) {
    return ok(await this.admin.updateTopic(id, body));
  }
  @Delete('topics/:id')
  async deleteTopic(@Param('id') id: string) {
    return ok(await this.admin.deleteTopic(id));
  }
  @Post('posts/:id/topic')
  async setPostTopic(@Param('id') id: string, @Body() body: { topicId?: string | null }) {
    return ok(await this.admin.setPostTopic(id, body.topicId ?? null));
  }
}
