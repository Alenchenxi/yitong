import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { ActivityService } from './activity.service';
import {
  CreateActivityDto,
  CreateLarkConnectionDto,
  EnrollActivityDto,
  ListActivitiesDto,
  ListMyActivitiesDto,
  RemindDto,
  ReviewEnrollmentDto,
  RevokeEnrollmentDto,
  SetActivityAdminsDto,
  SetInterestDto,
  SetLarkConfigDto,
  TransferInitiatorDto,
  UpdateActivityDto,
  UpdateEnrollmentDto,
} from './dto';

// 活动模块路由（specs/features/活动模块.md §6）
// 鉴权：全局 JwtAuthGuard；静态路由（new-arrivals/mine/lark-connections）先于 :id 注册
@Controller('activities')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  // ===== 发现 =====

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query() query: ListActivitiesDto) {
    return ok(await this.activity.list(req.user!.uid, query));
  }

  @Get('new-arrivals')
  async newArrivals(@Req() req: AuthenticatedRequest) {
    return ok(await this.activity.newArrivals(req.user!.uid));
  }

  @Get('mine')
  async mine(@Req() req: AuthenticatedRequest, @Query() query: ListMyActivitiesDto) {
    return ok(await this.activity.mine(req.user!.uid, query.tab));
  }

  @Get(':id')
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.detail(req.user!.uid, id));
  }

  // ===== 发布与生命周期 =====

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateActivityDto) {
    return ok(await this.activity.create(req.user!.uid, dto));
  }

  @Put(':id')
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return ok(await this.activity.update(req.user!.uid, id, dto));
  }

  @Post(':id/publish')
  async publish(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.publish(req.user!.uid, id));
  }

  @Post(':id/cancel')
  async cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.cancel(req.user!.uid, id));
  }

  @Post(':id/delist')
  async delist(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.delist(req.user!.uid, id));
  }

  @Post(':id/finish')
  async finish(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.finish(req.user!.uid, id));
  }

  @Post(':id/transfer')
  async transfer(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: TransferInitiatorDto) {
    return ok(await this.activity.transferInitiator(req.user!.uid, id, dto));
  }

  @Post(':id/admins')
  async setAdmins(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SetActivityAdminsDto) {
    return ok(await this.activity.setAdmins(req.user!.uid, id, dto));
  }

  @Post(':id/lark-config')
  async setLarkConfig(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SetLarkConfigDto) {
    return ok(await this.activity.setLarkConfig(req.user!.uid, id, dto));
  }

  // ===== 报名 =====

  @Post(':id/enrollments')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 防重复点击的服务端兜底（AC §4.9）
  async enroll(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: EnrollActivityDto) {
    return ok(await this.activity.enroll(req.user!.uid, id, dto));
  }

  @Put(':id/enrollments')
  async updateEnrollment(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateEnrollmentDto) {
    return ok(await this.activity.updateMyEnrollment(req.user!.uid, id, dto));
  }

  @Post(':id/enrollments/cancel')
  async cancelEnrollment(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.cancelMyEnrollment(req.user!.uid, id));
  }

  @Get(':id/enrollments')
  async listEnrollments(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('status') status: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Number.parseInt(page ?? '1', 10) || 1;
    const ps = Math.min(Number.parseInt(pageSize ?? '20', 10) || 20, 100);
    return ok(await this.activity.listEnrollments(req.user!.uid, id, status || 'PENDING_REVIEW', p, ps));
  }

  @Post(':id/enrollments/:eid/approve')
  async approve(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('eid') eid: string) {
    await this.activity.approve(req.user!.uid, id, eid);
    return ok({ approved: true });
  }

  @Post(':id/enrollments/:eid/reject')
  async reject(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('eid') eid: string,
    @Body() dto: ReviewEnrollmentDto,
  ) {
    await this.activity.reject(req.user!.uid, id, eid, dto);
    return ok({ rejected: true });
  }

  @Post(':id/enrollments/:eid/revoke')
  async revoke(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('eid') eid: string,
    @Body() dto: RevokeEnrollmentDto,
  ) {
    await this.activity.revoke(req.user!.uid, id, eid, dto.reason);
    return ok({ revoked: true });
  }

  // ===== 兴趣 =====

  @Post(':id/interest')
  async setInterest(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SetInterestDto) {
    await this.activity.setInterest(req.user!.uid, id, dto);
    return ok({ done: true });
  }

  // ===== 提醒 =====

  @Post(':id/remind')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async remind(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RemindDto) {
    return ok(await this.activity.remind(req.user!.uid, id, dto));
  }

  @Get(':id/reminders')
  async listReminders(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    const p = Number.parseInt(page ?? '1', 10) || 1;
    return ok(await this.activity.listReminders(req.user!.uid, id, p));
  }

  // ===== 群聊 =====

  @Post(':id/chat/messages')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async sendChatMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return ok(await this.activity.sendChatMessage(req.user!.uid, id, content));
  }

  @Get(':id/chat/messages')
  async listChatMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return ok(await this.activity.listChatMessages(req.user!.uid, id, cursor));
  }

  // ===== 飞书同步 =====

  @Get(':id/sync-records')
  async listSyncRecords(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.listSyncRecords(req.user!.uid, id));
  }

  @Post(':id/sync-retry')
  async retrySync(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.retrySync(req.user!.uid, id));
  }
}

// 飞书连接独立资源（/lark-connections），仍挂在本文件便于同模块维护
@Controller('lark-connections')
export class LarkConnectionController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return ok(await this.activity.listConnections(req.user!.uid));
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLarkConnectionDto) {
    return ok(await this.activity.createConnection(req.user!.uid, dto));
  }

  @Delete(':id')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return ok(await this.activity.deleteConnection(req.user!.uid, id));
  }
}
