import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  AppStatus,
  JobDuration,
  JobPostStatus,
  MerchantStatus,
  Prisma,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import type { CreateJobPostDto, JobListQueryDto, CreateReviewDto } from './dto/job.dto';

// 错误码 4xxxx 兼职段（API 规范 §3）：40001 岗位不存在 / 40002 重复报名 / 40003 已下架 / 40004 状态非法流转 / 40005 不能评价
@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  // 商家发岗：需 Merchant APPROVED。创建 PENDING 草稿；发布由 feat/payment 负责（付费后置 PUBLISHED + expireAt）
  async createPost(merchantUid: string, dto: CreateJobPostDto, openid?: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || merchant.status !== MerchantStatus.APPROVED) {
      throw new BizException(60003, '商家资质未审核通过，不能发岗', HttpStatus.FORBIDDEN);
    }
    await this.moderation.checkText(dto.description, openid);

    const days = dto.duration === JobDuration.D90 ? 90 : 30;
    const expireAt = new Date(Date.now() + days * 86_400_000);
    const post = await this.prisma.jobPost.create({
      data: {
        merchantId: merchant.id,
        title: dto.title,
        description: dto.description,
        salary: dto.salary,
        location: dto.location,
        duration: dto.duration,
        expireAt,
        status: JobPostStatus.PENDING,
      },
      include: { merchant: { select: { shopName: true } } },
    });

    // 发布由 feat/payment 负责（付费后置 PUBLISHED + expireAt）；此处保持 PENDING 草稿
    return this.toPostVo(await this.refreshPost(post.id));
  }

  // 岗位列表：mine=1 商家自己的（含草稿）；否则 PUBLISHED 且未过期
  async listPosts(uid: string, q: JobListQueryDto) {
    const limit = q.limit ?? 20;
    const where: Prisma.JobPostWhereInput = {};
    if (q.mine === 1) {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
      if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
      where.merchantId = merchant.id;
    } else {
      where.status = JobPostStatus.PUBLISHED;
      where.expireAt = { gt: new Date() };
    }
    if (q.cursor) {
      const t = new Date(q.cursor);
      if (!Number.isNaN(t.getTime())) where.createdAt = { lt: t };
    }
    const posts = await this.prisma.jobPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { merchant: { select: { shopName: true } } },
    });
    const hasMore = posts.length > limit;
    const slice = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1]!.createdAt.toISOString() : null;
    return { list: slice.map((p) => this.toPostVo(p)), nextCursor, hasMore };
  }

  async getPost(id: string) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id },
      include: { merchant: { select: { shopName: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    return this.toPostVo(post);
  }

  // 用户报名：防重（@@unique），岗位须 PUBLISHED 且未过期
  async apply(uid: string, postId: string) {
    const post = await this.prisma.jobPost.findUnique({ where: { id: postId } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.status !== JobPostStatus.PUBLISHED) throw new BizException(40003, '岗位已下架');
    if (post.expireAt.getTime() < Date.now()) throw new BizException(40003, '岗位已过期');
    try {
      const app = await this.prisma.jobApplication.create({
        data: { jobPostId: postId, userId: uid, status: AppStatus.PENDING },
        include: { jobPost: { select: { title: true } } },
      });
      return this.toAppVo(app);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(40002, '已报名过该岗位', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }

  // 商家查某岗位报名（需岗位属于该商家）
  async listApplications(uid: string, postId: string) {
    await this.assertOwnsPost(uid, postId);
    const apps = await this.prisma.jobApplication.findMany({
      where: { jobPostId: postId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { nickname: true } }, jobPost: { select: { title: true } } },
    });
    return apps.map((a) => this.toAppVo(a));
  }

  // 用户自己的报名
  async listMyApplications(uid: string) {
    const apps = await this.prisma.jobApplication.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      include: { jobPost: { select: { title: true, merchant: { select: { shopName: true } } } } },
    });
    return apps.map((a) => this.toAppVo(a));
  }

  // 状态流转：accept(PENDING->ACCEPTED，商家) / complete(ACCEPTED->DONE，商家或学生)
  async transition(uid: string, appId: string, action: 'accept' | 'complete') {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { jobPost: { select: { id: true, merchantId: true } } },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);

    if (action === 'accept') {
      await this.assertOwnsPost(uid, app.jobPost.id);
      if (app.status !== AppStatus.PENDING) {
        throw new BizException(40004, `状态非法流转：${app.status} -> ACCEPTED`, HttpStatus.CONFLICT);
      }
      await this.prisma.jobApplication.update({ where: { id: appId }, data: { status: AppStatus.ACCEPTED } });
    } else {
      // complete：商家（拥有岗位）或学生（app.userId）
      const isOwner = await this.ownsPost(uid, app.jobPost.id);
      if (!isOwner && app.userId !== uid) {
        throw new BizException(10003, '无权操作', HttpStatus.FORBIDDEN);
      }
      if (app.status !== AppStatus.ACCEPTED) {
        throw new BizException(40004, `状态非法流转：${app.status} -> DONE`, HttpStatus.CONFLICT);
      }
      await this.prisma.jobApplication.update({ where: { id: appId }, data: { status: AppStatus.DONE } });
    }
    const refreshed = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { user: { select: { nickname: true } }, jobPost: { select: { title: true } } },
    });
    return this.toAppVo(refreshed!);
  }

  // 评价：仅学生（app.userId），且 application DONE + 未评价过
  async review(uid: string, appId: string, dto: CreateReviewDto, openid?: string) {
    const app = await this.prisma.jobApplication.findUnique({ where: { id: appId } });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
    if (app.userId !== uid) throw new BizException(10003, '无权评价', HttpStatus.FORBIDDEN);
    if (app.status !== AppStatus.DONE) {
      throw new BizException(40005, '岗位未完成，不能评价', HttpStatus.CONFLICT);
    }
    await this.moderation.checkText(dto.content, openid);
    try {
      const r = await this.prisma.jobReview.create({
        data: { applicationId: appId, rating: dto.rating, content: dto.content },
      });
      return this.toReviewVo(r, uid);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(40005, '已评价过', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }

  async listReviews(postId: string) {
    const reviews = await this.prisma.jobReview.findMany({
      where: { application: { jobPostId: postId } },
      orderBy: { createdAt: 'desc' },
      include: { application: { select: { userId: true, user: { select: { nickname: true } } } } },
    });
    return reviews.map((r) => this.toReviewVo(r, r.application.userId));
  }

  private async assertOwnsPost(uid: string, postId: string) {
    if (!(await this.ownsPost(uid, postId))) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
  }

  private async ownsPost(uid: string, postId: string): Promise<boolean> {
    const post = await this.prisma.jobPost.findUnique({
      where: { id: postId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    return post.merchant.userId === uid;
  }

  private async refreshPost(id: string) {
    const p = await this.prisma.jobPost.findUnique({
      where: { id },
      include: { merchant: { select: { shopName: true } } },
    });
    if (!p) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    return p;
  }

  private toPostVo(p: {
    id: string;
    merchantId: string;
    title: string;
    description: string;
    salary: string;
    location: string;
    duration: JobDuration;
    expireAt: Date;
    status: JobPostStatus;
    createdAt: Date;
    merchant?: { shopName: string };
  }) {
    return {
      id: p.id,
      merchantId: p.merchantId,
      merchantShopName: p.merchant?.shopName ?? '',
      title: p.title,
      description: p.description,
      salary: p.salary,
      location: p.location,
      duration: p.duration,
      expireAt: p.expireAt.toISOString(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private toAppVo(a: {
    id: string;
    jobPostId: string;
    userId: string;
    status: AppStatus;
    createdAt: Date;
    user?: { nickname: string };
    jobPost?: { title: string };
  }) {
    return {
      id: a.id,
      jobPostId: a.jobPostId,
      jobPostTitle: a.jobPost?.title ?? '',
      userId: a.userId,
      userNickname: a.user?.nickname ?? '',
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    };
  }

  private toReviewVo(r: { id: string; applicationId: string; rating: number; content: string; createdAt: Date }, reviewerId: string) {
    return {
      id: r.id,
      applicationId: r.applicationId,
      reviewerId,
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
