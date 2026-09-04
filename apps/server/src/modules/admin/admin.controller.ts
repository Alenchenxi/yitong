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
import { UpdateAppConfigDto } from './dto/update-app-config.dto';
import { RejectCommunityDto } from './dto/reject-community.dto';
import {
  CreateAdminTypeDto,
  UpdateAdminAssignmentDto,
  UpdateAdminTypeDto,
} from './dto/admin-type.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import {
  ModerationContextDto,
  ModerateUserDto,
  RestoreModeratedContentDto,
} from './dto/moderation-context.dto';
import {
  AllowAnyAdmin,
  RequireAdminPermission,
} from './admin-access.decorator';
import { ADMIN_PERMISSIONS } from './admin-permissions';
import { Body, Param, Post, Put, UseGuards } from '@nestjs/common';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get('access/me')
  @AllowAnyAdmin()
  accessMe(@Req() req: Request) {
    return ok((req as AuthenticatedRequest).adminAccess);
  }

  @Get('moderation-contexts')
  @AllowAnyAdmin()
  async getModerationContexts(@Req() req: Request) {
    return ok(await this.admin.getModerationContexts((req as AuthenticatedRequest).adminAccess!));
  }

  @Get('queue')
  @RequireAdminPermission(ADMIN_PERMISSIONS.MERCHANT_REVIEW)
  async queue() {
    return ok(await this.admin.getQueue());
  }

  // P1-28 举报处理队列
  @Get('reports')
  @RequireAdminPermission(ADMIN_PERMISSIONS.REPORT_MANAGE)
  async listReports(
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query() context: ModerationContextDto,
    @Req() req: Request,
  ) {
    return ok(
      await this.admin.listReports(
        status,
        Math.max(1, Number(page) || 1),
        Math.min(100, Math.max(1, Number(pageSize) || 20)),
        (req as AuthenticatedRequest).adminAccess!,
        context.scope,
        context.communityId,
      ),
    );
  }

  @Post('reports/:id/resolve')
  @RequireAdminPermission(ADMIN_PERMISSIONS.REPORT_MANAGE)
  async resolveReport(@Param('id') id: string, @Body() dto: ResolveReportDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.resolveReport(id, uid, dto, (req as AuthenticatedRequest).adminAccess!));
  }

  @Get('stats')
  @RequireAdminPermission(ADMIN_PERMISSIONS.DASHBOARD_VIEW)
  async stats() {
    return ok(await this.dashboard.getStats());
  }

  @Post('merchants/:id/approve')
  @RequireAdminPermission(ADMIN_PERMISSIONS.MERCHANT_REVIEW)
  async approveMerchant(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.approveMerchant(id, uid, reason));
  }

  @Post('merchants/:id/reject')
  @RequireAdminPermission(ADMIN_PERMISSIONS.MERCHANT_REVIEW)
  async rejectMerchant(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.rejectMerchant(id, uid, reason));
  }

  @Post('merchants/batch')
  @RequireAdminPermission(ADMIN_PERMISSIONS.MERCHANT_REVIEW)
  async batchMerchants(@Body() dto: BatchMerchantDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.batchMerchants(dto.ids, dto.action, uid, dto.reason));
  }

  @Post('posts/:id/takedown')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async takedownPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.takedownPost(id, uid, reason, (req as AuthenticatedRequest).adminAccess!));
  }

  @Post('anon-posts/:id/takedown')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async takedownAnonPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.takedownAnonPost(id, uid, reason, (req as AuthenticatedRequest).adminAccess!));
  }

  // R4 岗位下架（管理员主动处置，不依赖举报）
  @Post('job-posts/:id/takedown')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async takedownJobPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const reason = (req.body as { reason?: string })?.reason;
    return ok(await this.admin.takedownJobPost(id, uid, reason, (req as AuthenticatedRequest).adminAccess!));
  }

  @Post('posts/:id/restore')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async restorePost(@Param('id') id: string, @Body() dto: RestoreModeratedContentDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.restorePost(id, dto.expectedVersion, uid, (req as AuthenticatedRequest).adminAccess!));
  }

  @Post('anon-posts/:id/restore')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async restoreAnonPost(@Param('id') id: string, @Body() dto: RestoreModeratedContentDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.restoreAnonPost(id, dto.expectedVersion, uid, (req as AuthenticatedRequest).adminAccess!));
  }

  @Post('job-posts/:id/restore')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async restoreJobPost(@Param('id') id: string, @Body() dto: RestoreModeratedContentDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.restoreJobPost(id, dto.expectedVersion, uid, (req as AuthenticatedRequest).adminAccess!));
  }

  // P2-05 帖子置顶/取消置顶
  @Post('posts/:id/pin')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async pinPost(@Param('id') id: string, @Body() body: { pinned?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.pinPost(id, uid, body?.pinned !== false, (req.body as { reason?: string })?.reason, (req as AuthenticatedRequest).adminAccess!));
  }

  // P2-05 帖子加精/取消加精
  @Post('posts/:id/feature')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async featurePost(@Param('id') id: string, @Body() body: { featured?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.featurePost(id, uid, body?.featured !== false, (req.body as { reason?: string })?.reason, (req as AuthenticatedRequest).adminAccess!));
  }

  // P2-15 兼职精品 toggle
  @Post('job-posts/:id/feature')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async featureJob(@Param('id') id: string, @Body() body: { featured?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.featureJob(id, uid, body?.featured !== false, (req as AuthenticatedRequest).adminAccess!));
  }

  // ===== P2-20 工单管理 =====
  @Get('tickets')
  @RequireAdminPermission(ADMIN_PERMISSIONS.TICKET_MANAGE)
  async listTickets(@Query('status') status: string | undefined) {
    return ok(await this.admin.listTickets(status));
  }
  @Post('tickets/:id/reply')
  @RequireAdminPermission(ADMIN_PERMISSIONS.TICKET_MANAGE)
  async replyTicket(
    @Param('id') id: string,
    @Body() body: { reply?: string; close?: boolean },
    @Req() req: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.replyTicket(id, uid, body.reply ?? '', body.close !== false));
  }

  @Post('tickets/:id/reopen')
  @RequireAdminPermission(ADMIN_PERMISSIONS.TICKET_MANAGE)
  async reopenTicket(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.reopenTicket(id, uid));
  }

  // ===== 用户管理 =====
  @Get('users')
  @RequireAdminPermission(ADMIN_PERMISSIONS.USER_MANAGE)
  async listUsers(
    @Query('keyword') keyword: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('scope') scope: ModerationContextDto['scope'],
    @Query('communityId') communityId: string | undefined,
    @Req() req: Request,
  ) {
    return ok(await this.admin.listUsers(keyword, limit ? Number(limit) : 50, scope, communityId, (req as AuthenticatedRequest).adminAccess!));
  }

  // ===== 兼职岗位列表（admin，精品管理）=====
  @Get('job-posts')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async listJobPostsAdmin(
    @Req() req: Request,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('scope') scope: ModerationContextDto['scope'],
    @Query('communityId') communityId: string | undefined,
  ) {
    return ok(await this.admin.listJobPostsAdmin(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 20)),
      scope,
      communityId,
      (req as AuthenticatedRequest).adminAccess!,
    ));
  }

  // C 帖子分页管理（getQueue 精简掉 posts/anonPosts 后的独立分页接口）
  @Get('posts')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async listPostsAdmin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('scope') scope?: ModerationContextDto['scope'],
    @Query('communityId') communityId?: string,
    @Req() req?: Request,
  ) {
    return ok(
      await this.admin.listPostsAdmin(
        Math.max(1, Number(page) || 1),
        Math.min(100, Math.max(1, Number(pageSize) || 20)),
        keyword,
        status,
        scope,
        communityId,
        (req as AuthenticatedRequest).adminAccess!,
      ),
    );
  }

  @Get('anon-posts')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async listAnonPostsAdmin(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('scope') scope?: ModerationContextDto['scope'],
    @Query('communityId') communityId?: string,
  ) {
    return ok(
      await this.admin.listAnonPostsAdmin(
        Math.max(1, Number(page) || 1),
        Math.min(100, Math.max(1, Number(pageSize) || 20)),
        scope,
        communityId,
        (req as AuthenticatedRequest).adminAccess!,
      ),
    );
  }

  // F 评论管理（人工置顶）
  @Get('comments')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async listCommentsAdmin(
    @Query('postId') postId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('authorId') authorId?: string,
    @Query('authorNickname') authorNickname?: string,
    @Query('postTitleKw') postTitleKw?: string,
    @Req() req?: Request,
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
        (req as AuthenticatedRequest).adminAccess!,
      ),
    );
  }

  @Post('comments/:id/pin')
  @RequireAdminPermission(ADMIN_PERMISSIONS.CONTENT_MODERATE)
  async pinComment(@Param('id') id: string, @Body() body: { pinned?: boolean }, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.pinComment(id, uid, body?.pinned !== false, (req as AuthenticatedRequest).adminAccess!));
  }

  @Get('pricing')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async getPricing() {
    return ok(await this.admin.getPricing());
  }

  @Put('pricing')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async updatePricing(@Body() dto: UpdatePricingDto) {
    return ok(await this.admin.updatePricing(dto));
  }

  // 内容推广档位：列表 + 改价（后台「推广价」配置）
  @Get('boost-plans')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async getBoostPlans() {
    return ok(await this.admin.getBoostPlans());
  }

  @Put('boost-plans/:code')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async updateBoostPlanPrice(@Param('code') code: string, @Body() dto: UpdateBoostPlanPriceDto) {
    return ok(await this.admin.updateBoostPlanPrice(code, dto));
  }

  @Post('users/:id/ban')
  @RequireAdminPermission(ADMIN_PERMISSIONS.USER_MANAGE)
  async banUser(@Param('id') id: string, @Body() dto: ModerateUserDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.banUser(id, dto.scope, dto.communityId, dto.reason, uid, (req as AuthenticatedRequest).adminAccess!));
  }

  @Post('users/:id/unban')
  @RequireAdminPermission(ADMIN_PERMISSIONS.USER_MANAGE)
  async unbanUser(@Param('id') id: string, @Body() dto: ModerationContextDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.admin.unbanUser(id, dto.scope, dto.communityId, uid, (req as AuthenticatedRequest).adminAccess!));
  }

  // P1-12 禁言（body { days?: number }；不传或 0 = 解除）
  @Post('users/:id/mute')
  @RequireAdminPermission(ADMIN_PERMISSIONS.USER_MANAGE)
  async muteUser(@Param('id') id: string, @Body() body: { days?: number }) {
    return ok(await this.admin.muteUser(id, body?.days));
  }

  // ===== P1-13 树洞标签库管理 =====
  @Get('anon-tags')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async listAnonTags(@Query('category') category?: string) {
    return ok(await this.admin.listAnonTags(category));
  }

  @Post('anon-tags')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async createAnonTag(@Body() dto: CreateAnonTagDto) {
    return ok(await this.admin.createAnonTag(dto));
  }

  @Put('anon-tags/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async updateAnonTag(@Param('id') id: string, @Body() dto: UpdateAnonTagDto) {
    return ok(await this.admin.updateAnonTag(id, dto));
  }

  @Delete('anon-tags/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async deleteAnonTag(@Param('id') id: string) {
    return ok(await this.admin.deleteAnonTag(id));
  }

  // ===== P2-03 活动专题管理 =====
  @Get('activity-topics')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async listActivityTopicsAll() {
    return ok(await this.admin.listActivityTopicsAll());
  }
  @Post('activity-topics')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async createActivityTopic(@Body() body: { title: string; coverUrl?: string; description?: string; status?: string; sortOrder?: number }) {
    return ok(await this.admin.createActivityTopic(body));
  }
  @Put('activity-topics/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async updateActivityTopic(@Param('id') id: string, @Body() body: Partial<{ title: string; coverUrl: string | null; description: string | null; status: string; sortOrder: number }>) {
    return ok(await this.admin.updateActivityTopic(id, body));
  }
  @Delete('activity-topics/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async deleteActivityTopic(@Param('id') id: string) {
    return ok(await this.admin.deleteActivityTopic(id));
  }
  @Post('activity-topics/:id/posts')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async addTopicPost(@Param('id') id: string, @Body() body: { postId: string; sortOrder?: number }) {
    return ok(await this.admin.addTopicPost(id, body.postId, body.sortOrder ?? 0));
  }
  @Delete('activity-topics/:id/posts/:postId')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async removeTopicPost(@Param('id') id: string, @Param('postId') postId: string) {
    return ok(await this.admin.removeTopicPost(id, postId));
  }

  // ===== P2-04 话题管理 =====
  @Get('topics')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async listTopicsAll() {
    return ok(await this.admin.listTopicsAll());
  }
  @Post('topics')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async createTopic(@Body() body: { name: string; description?: string; coverUrl?: string; status?: string; sortOrder?: number }) {
    return ok(await this.admin.createTopic(body));
  }
  @Put('topics/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async updateTopic(@Param('id') id: string, @Body() body: Partial<{ name: string; description: string | null; coverUrl: string | null; status: string; sortOrder: number }>) {
    return ok(await this.admin.updateTopic(id, body));
  }
  @Delete('topics/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async deleteTopic(@Param('id') id: string) {
    return ok(await this.admin.deleteTopic(id));
  }
  @Post('posts/:id/topic')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async setPostTopic(@Param('id') id: string, @Body() body: { topicId?: string | null }) {
    return ok(await this.admin.setPostTopic(id, body.topicId ?? null));
  }

  // ===== Banner 广告位管理 =====
  @Get('banners')
  @RequireAdminPermission(ADMIN_PERMISSIONS.BANNER_MANAGE)
  async listBanners(@Req() req: Request, @Query('communityId') communityId?: string, @Query('keyword') keyword?: string) {
    return ok(await this.admin.listBanners(communityId, keyword, (req as AuthenticatedRequest).adminAccess!));
  }
  @Post('banners')
  @RequireAdminPermission(ADMIN_PERMISSIONS.BANNER_MANAGE)
  async createBanner(@Body() body: { title: string; imageUrl: string; linkUrl?: string | null; communityId: string; sortOrder?: number }, @Req() req: Request) {
    return ok(await this.admin.createBanner(body, (req as AuthenticatedRequest).adminAccess!));
  }
  @Put('banners/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.BANNER_MANAGE)
  async updateBanner(
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; imageUrl: string; linkUrl: string | null; communityId: string; sortOrder: number; status: string }>,
    @Req() req: Request,
  ) {
    return ok(await this.admin.updateBanner(id, body, (req as AuthenticatedRequest).adminAccess!));
  }
  @Delete('banners/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.BANNER_MANAGE)
  async deleteBanner(@Param('id') id: string, @Req() req: Request) {
    return ok(await this.admin.deleteBanner(id, (req as AuthenticatedRequest).adminAccess!));
  }
  @Post('banners/:id/toggle')
  @RequireAdminPermission(ADMIN_PERMISSIONS.BANNER_MANAGE)
  async toggleBanner(@Param('id') id: string, @Body() body: { enabled: boolean }, @Req() req: Request) {
    return ok(await this.admin.toggleBanner(id, body.enabled, (req as AuthenticatedRequest).adminAccess!));
  }

  // ===== 圈子（Community）管理 =====
  @Get('communities')
  @RequireAdminPermission(ADMIN_PERMISSIONS.COMMUNITY_VIEW)
  async listCommunities(@Req() req: Request, @Query('status') status?: string, @Query('keyword') keyword?: string) {
    return ok(await this.admin.listCommunities(status, keyword, (req as AuthenticatedRequest).adminAccess!));
  }
  @Put('communities/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.COMMUNITY_EDIT)
  async updateCommunity(@Param('id') id: string, @Body() dto: UpdateCommunityDto, @Req() req: Request) {
    return ok(await this.admin.updateCommunity(id, dto, (req as AuthenticatedRequest).adminAccess!));
  }
  @Post('communities/:id/disable')
  @RequireAdminPermission(ADMIN_PERMISSIONS.COMMUNITY_EDIT)
  async disableCommunity(@Param('id') id: string, @Req() req: Request) {
    return ok(await this.admin.disableCommunity(id, (req as AuthenticatedRequest).adminAccess!));
  }
  @Post('communities/:id/enable')
  @RequireAdminPermission(ADMIN_PERMISSIONS.COMMUNITY_EDIT)
  async enableCommunity(@Param('id') id: string, @Req() req: Request) {
    return ok(await this.admin.enableCommunity(id, (req as AuthenticatedRequest).adminAccess!));
  }

  // ===== P2-26 圈子审核 =====
  @Post('communities/:id/approve')
  @RequireAdminPermission(ADMIN_PERMISSIONS.COMMUNITY_REVIEW)
  async approveCommunity(@Param('id') id: string, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(await this.admin.approveCommunity(id, openid, (req as AuthenticatedRequest).adminAccess!));
  }
  @Post('communities/:id/reject')
  @RequireAdminPermission(ADMIN_PERMISSIONS.COMMUNITY_REVIEW)
  async rejectCommunity(@Param('id') id: string, @Body() dto: RejectCommunityDto, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(await this.admin.rejectCommunity(id, openid, dto.reason, (req as AuthenticatedRequest).adminAccess!));
  }

  // ===== P2-26 全局配置 KV =====
  // ⚠️ 同步 controller 调 async service 会让 response.data 变 {}（ok(Promise) 序列化空对象）；
  // service 抛 BizException 时也会触发 unhandledRejection（NestJS 异常过滤器抓不到非 Promise 返回）。
  // 与同文件 updateSetting 一致：必须 async + await。
  @Get('settings')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  async getSettings() {
    return ok(await this.admin.getSettings());
  }
  @Put('settings/:key')
  @RequireAdminPermission(ADMIN_PERMISSIONS.GLOBAL_OPERATIONS)
  // P2-26: 必须 async + await，否则 admin.updateSetting 抛 BizException 时
  // Promise rejection 不会被 NestJS 捕获 → unhandledRejection 进程崩溃；
  // 即便不 throw，ok(<Promise>) 同步返回 Promise 对象，response data 也会变 {}
  async updateSetting(@Param('key') key: string, @Body() dto: UpdateAppConfigDto, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(await this.admin.updateSetting(key, dto.value, openid));
  }

  // ===== P2-30 管理员自助管理（AdminUser CRUD）=====
  // 列表：keyword 模糊匹配关联用户昵称 / username / openid；响应带 isSelf 给前端 disable「删除自己」按钮
  @Get('admins')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGE)
  async listAdmins(@Query() q: ListAdminsDto, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(await this.admin.listAdmins(q.keyword, openid));
  }

  // 搜索候选 User（用于"添加管理员"弹窗）：排除已是 admin
  @Get('users/search')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGE)
  async searchCandidateUsers(@Query() q: SearchUsersDto) {
    return ok(await this.admin.searchCandidateUsers(q.keyword));
  }

  // 添加管理员：body { userId } -> 查 User openid -> upsert AdminUser + UserRole.ADMIN
  @Post('admins')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGE)
  async createAdmin(@Body() dto: CreateAdminDto, @Req() req: Request) {
    return ok(await this.admin.createAdmin(dto, (req as AuthenticatedRequest).adminAccess!));
  }

  @Put('admins/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGE)
  async updateAdmin(@Param('id') id: string, @Body() dto: UpdateAdminAssignmentDto, @Req() req: Request) {
    return ok(await this.admin.updateAdmin(id, dto, (req as AuthenticatedRequest).adminAccess!));
  }

  // 删除管理员：自删保护 + 至少保留 1 个 admin（service 内校验）
  @Delete('admins/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_MANAGE)
  async deleteAdmin(@Param('id') id: string, @Req() req: Request) {
    const openid = (req as AuthenticatedRequest).user!.openid;
    return ok(await this.admin.deleteAdmin(id, openid, (req as AuthenticatedRequest).adminAccess!));
  }

  @Get('admin-types')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE)
  async listAdminTypes() {
    return ok(await this.admin.listAdminTypes());
  }

  @Post('admin-types')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE)
  async createAdminType(@Body() dto: CreateAdminTypeDto, @Req() req: Request) {
    return ok(await this.admin.createAdminType(dto, (req as AuthenticatedRequest).adminAccess!));
  }

  @Put('admin-types/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE)
  async updateAdminType(@Param('id') id: string, @Body() dto: UpdateAdminTypeDto, @Req() req: Request) {
    return ok(await this.admin.updateAdminType(id, dto, (req as AuthenticatedRequest).adminAccess!));
  }

  @Delete('admin-types/:id')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE)
  async deleteAdminType(@Param('id') id: string, @Req() req: Request) {
    return ok(await this.admin.deleteAdminType(id, (req as AuthenticatedRequest).adminAccess!));
  }

  @Get('permissions')
  @RequireAdminPermission(ADMIN_PERMISSIONS.ADMIN_TYPE_MANAGE)
  listPermissions() {
    return ok(this.admin.listPermissions());
  }

  @Get('audit-logs')
  @RequireAdminPermission(ADMIN_PERMISSIONS.AUDIT_VIEW)
  async listAuditLogs(@Req() req: Request, @Query('limit') limit?: string) {
    return ok(await this.admin.listAuditLogs((req as AuthenticatedRequest).adminAccess!, Number(limit) || 50));
  }
}
