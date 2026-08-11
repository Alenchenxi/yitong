import { Controller, Get, Req, Query, Delete } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { AdminGuard } from '../auth/admin.guard';
import { DashboardService } from './dashboard.service';
import { AdminService } from './admin.service';
import { BatchMerchantDto } from './dto/batch-merchant.dto';
import { UpdateBoostPlanPriceDto } from './dto/update-boost-plan-price.dto';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { CreateAnonTagDto, UpdateAnonTagDto } from './dto/anon-tag.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { ListAdminsDto } from './dto/list-admins.dto';
import { SearchUsersDto } from './dto/search-users.dto';
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

  // R4 岗位下架（管理员主动处置，不依赖举报）
  @Post('job-posts/:id/takedown')
  async takedownJobPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.takedownJobPost(id, uid, reason));
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

  // ===== P2-20 工单管理 =====
  @Get('tickets')
  async listTickets(@Query('status') status: string | undefined) {
    return ok(await this.admin.listTickets(status));
  }
  @Post('tickets/:id/reply')
  async replyTicket(
    @Param('id') id: string,
    @Body() body: { reply?: string; close?: boolean },
    @Req() req: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.replyTicket(id, uid, body.reply ?? '', body.close !== false));
  }

  @Post('tickets/:id/reopen')
  async reopenTicket(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.reopenTicket(id, uid));
  }

  // ===== 用户管理 =====
  @Get('users')
  async listUsers(@Query('keyword') keyword: string | undefined, @Query('limit') limit: string | undefined) {
    return ok(await this.admin.listUsers(keyword, limit ? Number(limit) : 50));
  }

  // ===== 兼职岗位列表（admin，精品管理）=====
  @Get('job-posts')
  async listJobPostsAdmin(@Query('limit') limit: string | undefined) {
    return ok(await this.admin.listJobPostsAdmin(limit ? Number(limit) : 50));
  }

  // C 帖子分页管理（getQueue 精简掉 posts/anonPosts 后的独立分页接口）
  @Get('posts')
  async listPostsAdmin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
  ) {
    return ok(
      await this.admin.listPostsAdmin(
        Math.max(1, Number(page) || 1),
        Math.min(100, Math.max(1, Number(pageSize) || 20)),
        keyword,
        status,
      ),
    );
  }

  @Get('anon-posts')
  async listAnonPostsAdmin(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return ok(
      await this.admin.listAnonPostsAdmin(
        Math.max(1, Number(page) || 1),
        Math.min(100, Math.max(1, Number(pageSize) || 20)),
      ),
    );
  }

  // F 评论管理（人工置顶）
  @Get('comments')
  async listCommentsAdmin(
    @Query('postId') postId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('authorId') authorId?: string,
    @Query('authorNickname') authorNickname?: string,
    @Query('postTitleKw') postTitleKw?: string,
  ) {
    return ok(
      await this.admin.listCommentsAdmin(
        postId,
        Math.max(1, Number(page) || 1),
        Math.min(100, Math.max(1, Number(pageSize) || 20)),
        keyword,
        authorId,
        authorNickname,
        postTitleKw,
      ),
    );
  }

  @Post('comments/:id/pin')
  async pinComment(@Param('id') id: string, @Body() body: { pinned?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.pinComment(id, uid, body?.pinned !== false));
  }

  @Get('pricing')
  async getPricing() {
    return ok(await this.admin.getPricing());
  }

  @Put('pricing')
  async updatePricing(@Body() dto: UpdatePricingDto) {
    return ok(await this.admin.updatePricing(dto));
  }

  // 内容推广档位：列表 + 改价（后台「推广价」配置）
  @Get('boost-plans')
  async getBoostPlans() {
    return ok(await this.admin.getBoostPlans());
  }

  @Put('boost-plans/:code')
  async updateBoostPlanPrice(@Param('code') code: string, @Body() dto: UpdateBoostPlanPriceDto) {
    return ok(await this.admin.updateBoostPlanPrice(code, dto));
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
  @Get('activity-topics')
  async listActivityTopicsAll() {
    return ok(await this.admin.listActivityTopicsAll());
  }
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
  @Get('topics')
  async listTopicsAll() {
    return ok(await this.admin.listTopicsAll());
  }
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

  // ===== P2-30 管理员自助管理（AdminUser CRUD）=====
  // 列表：keyword 模糊匹配 username / openid；响应带 isSelf 给前端 disable「删除自己」按钮
  @Get('admins')
  listAdmins(@Query() q: ListAdminsDto, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(this.admin.listAdmins(q.keyword, openid));
  }

  // 搜索候选 User（用于"添加管理员"弹窗）：排除已是 admin
  @Get('users/search')
  searchCandidateUsers(@Query() q: SearchUsersDto) {
    return ok(this.admin.searchCandidateUsers(q.keyword));
  }

  // 添加管理员：body { userId } -> 查 User openid -> upsert AdminUser + UserRole.ADMIN
  @Post('admins')
  createAdmin(@Body() dto: CreateAdminDto) {
    return ok(this.admin.createAdmin(dto.userId));
  }

  // 删除管理员：自删保护 + 至少保留 1 个 admin（service 内校验）
  @Delete('admins/:id')
  deleteAdmin(@Param('id') id: string, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(this.admin.deleteAdmin(id, openid));
  }
}
