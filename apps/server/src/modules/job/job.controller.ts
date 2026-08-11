import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import type { AuthenticatedRequest } from '../auth/types';
import { JobService } from './job.service';
import { JobScheduler } from './job.scheduler';
import { JobTemplateService } from './job-template.service';
import { LocationService } from './location.service';
import { CreateJobPostDto, JobListQueryDto, TransitionDto, CreateReviewDto, ReportDto, ApplyDto, UpsertResumeDto, BatchTransitionDto, UpdateJobPostDto, JobPostStatsQueryDto, RecordImpressionsDto } from './dto/job.dto';
import { JobTemplateQueryDto } from './dto/job-template.dto';
import { GeocodeQueryDto, PoiDetailQueryDto, PlaceSuggestionQueryDto, ReverseGeocodeQueryDto } from './dto/location.dto';

// 注：API 规范 §6.4 用 PATCH /applications/:id，但 wx.request 不支持 PATCH，
// 故状态流转改用 POST /applications/:id/transition（语义等价，小程序友好）。
@Controller()
export class JobController {
  constructor(
    private readonly job: JobService,
    private readonly scheduler: JobScheduler,
    private readonly template: JobTemplateService,
    private readonly location: LocationService,
  ) {}

  // 智能生成流程(2026-08-10):类别网格 + 智能生成 + 百度地图选点
  @Get('job-categories')
  async jobCategories() {
    return ok(this.template.listCategories());
  }

  // /template 必须声明在 /:id 之前,避免被参数路由吞掉
  @Get('job-posts/template')
  async jobPostTemplate(@Query() q: JobTemplateQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.template.generate(uid, q));
  }

  // 百度地图 API 兜底校验:文本地址反查 poiId/lng/lat/city
  @Get('job-posts/geocode')
  async geocode(@Query() q: GeocodeQueryDto, @Req() req: Request) {
    // 鉴权要求登录;空 user 也算通,真鉴权交给全局 Guard
    (req as AuthenticatedRequest).user;
    return ok(await this.location.geocode(q.address));
  }

  @Get('job-posts/poi-detail')
  async poiDetail(@Query() q: PoiDetailQueryDto, @Req() req: Request) {
    (req as AuthenticatedRequest).user;
    return ok(await this.location.getPoiDetail(q.poiId));
  }

  // 百度地图 place suggestion:前端搜索框输入时实时调用,返回地址候选列表
  // GET /job-posts/place-suggestion?query=xxx&region=xxx
  @Get('job-posts/place-suggestion')
  async placeSuggestion(@Query() q: PlaceSuggestionQueryDto, @Req() req: Request) {
    (req as AuthenticatedRequest).user;
    return ok(await this.location.suggestPlaces(q.query, q.region));
  }

  // 百度地图反向地理编码:坐标 → POI/地址/城市,供发布岗"模糊定位后自动锁定默认选点"用
  // GET /job-posts/reverse-geocode?lng=xxx&lat=xxx&coordType=gcj02|bd09
  // 路由必须在 job-posts/:id 之前(否则会被吞成 :id=reverse-geocode)
  @Get('job-posts/reverse-geocode')
  async reverseGeocode(@Query() q: ReverseGeocodeQueryDto, @Req() req: Request) {
    (req as AuthenticatedRequest).user;
    return ok(await this.location.reverseGeocode(q.lng, q.lat, q.coordType));
  }

  @Post('job-posts')
  async createPost(@Body() dto: CreateJobPostDto, @Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.job.createPost(u.uid, dto, u.openid));
  }

  @Get('job-posts')
  async list(@Query() q: JobListQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.listPosts(uid, q));
  }

  // 推荐（须在 /:id 之前声明，避免被参数路由吞掉）
  @Get('job-posts/recommend')
  async recommend(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.recommend(uid));
  }

  // P2-15 精品岗位列表（前台）
  @Get('job-posts/featured')
  async featured(@Query('limit') limit: string | undefined) {
    return ok(await this.job.listFeatured(limit ? Number(limit) : 20));
  }

  @Get('job-posts/:id')
  async detail(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    // P2-16 记录浏览（已登录用户）
    if (uid) {
      this.job.recordView(uid, id).catch(() => undefined);
    }
    return ok(await this.job.getPost(id));
  }

  @Post('job-posts/:id/applications')
  async apply(@Param('id') id: string, @Body() dto: ApplyDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.apply(uid, id, dto));
  }

  // P0-23 批量录用/拒绝
  @Post('job-posts/:id/applications/batch')
  async batchTransition(@Param('id') id: string, @Body() dto: BatchTransitionDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.batchTransition(uid, id, dto.ids, dto.action));
  }

  // P0-21 我的简历（一人一份）：获取 / upsert
  @Get('resume')
  async getMyResume(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.getMyResume(uid));
  }

  @Put('resume')
  async upsertResume(@Body() dto: UpsertResumeDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.upsertResume(uid, dto));
  }

  // P1-22 简历投递记录（该用户所有报名/投递，含岗位标题 + 商家名 + 是否附简历）
  @Get('resume/applications')
  async listResumeApplications(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.listResumeApplications(uid));
  }

  // P0-19 举报岗位（创建 ModerationRecord，管理员审核队列可见）；P1-27 记录举报人
  @Post('job-posts/:id/report')
  async report(@Param('id') id: string, @Body() dto: ReportDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.report(uid, id, dto.reason));
  }

  // P1-27 举报商家
  @Post('merchants/:id/report')
  async reportMerchant(@Param('id') id: string, @Body() dto: ReportDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.reportMerchant(uid, id, dto.reason));
  }

  // P1-27 报名投诉（学生本人或岗位所属商家）
  @Post('applications/:id/report')
  async reportApplication(@Param('id') id: string, @Body() dto: ReportDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.reportApplication(uid, id, dto.reason));
  }

  @Get('job-posts/:id/applications')
  async listApps(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.listApplications(uid, id));
  }

  @Get('job-posts/:id/reviews')
  async listReviews(@Param('id') id: string) {
    return ok(await this.job.listReviews(id));
  }

  @Get('applications/me')
  async myApps(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.listMyApplications(uid));
  }

  // P2-16 商家招聘数据看板（range=day|week|month|all）
  @Get('merchant/dashboard')
  async merchantDashboard(@Query('range') range: string | undefined, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const r: 'day' | 'week' | 'month' | 'all' =
      range === 'day' || range === 'week' || range === 'month' ? range : 'all';
    return ok(await this.job.getMerchantDashboard(uid, r));
  }

  // 状态流转：accept(PENDING->ACCEPTED) / complete(ACCEPTED->DONE)
  @Post('applications/:id/cancel')
  async cancel(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.cancel(uid, id));
  }

  @Post('applications/:id/transition')
  async transition(@Param('id') id: string, @Body() dto: TransitionDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.transition(uid, id, dto.action));
  }

  @Post('applications/:id/review')
  async review(@Param('id') id: string, @Body() dto: CreateReviewDto, @Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.job.review(u.uid, id, dto, u.openid));
  }

  // P1-26 商家评价学生（仅商家拥有岗位，application DONE + 未评过）
  @Post('applications/:id/merchant-review')
  async merchantReview(@Param('id') id: string, @Body() dto: CreateReviewDto, @Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.job.reviewByMerchant(u.uid, id, dto, u.openid));
  }

  // dev 专用：手动触发到期下架（prod 禁止）
  @Post('job-posts/expire-now')
  async expireNow() {
    if (process.env.NODE_ENV === 'production') {
      throw new BizException(10003, 'prod 禁止手动触发', HttpStatus.FORBIDDEN);
    }
    return ok(await this.scheduler.expireJobPosts());
  }

  // M3-04 编辑岗位（商家可编辑未下架且属于自己的岗位；PUBLISHED 编辑后回退 PENDING 需重新发布）
  @Put('job-posts/:id')
  async updatePost(@Param('id') id: string, @Body() dto: UpdateJobPostDto, @Req() req: Request) {
    const u = (req as AuthenticatedRequest).user!;
    return ok(await this.job.updatePost(u.uid, id, dto, u.openid));
  }

  // M3-05 主动下架岗位（仅 PUBLISHED 可下架；保留下架时间）
  @Post('job-posts/:id/take-down')
  async takeDown(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.takeDownPost(uid, id));
  }

  // M3-07 商家硬删草稿（仅 PENDING 状态；非 PENDING 删除请走 take-down）
  @Delete('job-posts/:id')
  async deletePost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.deletePost(uid, id));
  }

  // M3-07 单岗位数据（曝光/报名/转化率 + 时间范围），商家仅查自己岗位
  @Get('job-posts/:id/stats')
  async postStats(@Param('id') id: string, @Query() q: JobPostStatsQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.getPostStats(uid, id, q.range));
  }

  // M3-08 曝光上报：前端 onShow 批量上报当前可见岗位 ID，后端按 (postId, userId, hourBucket) 去重
  @Post('job-posts/impressions')
  async recordImpressions(@Body() dto: RecordImpressionsDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    return ok(await this.job.recordImpressions(uid || null, dto));
  }

  // M3-08 重新发布：PUBLISHED / TAKEN_DOWN / EXPIRED → PENDING（强制重付）
  @Post('job-posts/:id/republish')
  async republishPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.republishPost(uid, id));
  }
}
