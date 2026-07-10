import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { JobService } from './job.service';
import { CreateJobPostDto, JobListQueryDto, TransitionDto, CreateReviewDto } from './dto/job.dto';

// 注：API 规范 §6.4 用 PATCH /applications/:id，但 wx.request 不支持 PATCH，
// 故状态流转改用 POST /applications/:id/transition（语义等价，小程序友好）。
@Controller()
export class JobController {
  constructor(private readonly job: JobService) {}

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

  @Get('job-posts/:id')
  async detail(@Param('id') id: string) {
    return ok(await this.job.getPost(id));
  }

  @Post('job-posts/:id/applications')
  async apply(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.job.apply(uid, id));
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

  // 状态流转：accept(PENDING->ACCEPTED) / complete(ACCEPTED->DONE)
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
}
