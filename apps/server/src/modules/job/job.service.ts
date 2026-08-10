import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  AppStatus,
  JobCategory,
  JobDuration,
  JobPostStatus,
  MerchantStatus,
  Prisma,
  Settlement,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import { WORK_DATE_VALUES, WORK_PERIOD_VALUES } from './dto/job.dto';
import type { CreateJobPostDto, JobListQueryDto, CreateReviewDto, ApplyDto, UpsertResumeDto, UpdateJobPostDto } from './dto/job.dto';

// 看板时间范围 -> since 阈值（day=24h, week=7d, month=30d, all=不限）
function rangeToSince(range: 'day' | 'week' | 'month' | 'all'): Date | null {
  if (range === 'all') return null;
  const ms = range === 'day' ? 86_400_000 : range === 'week' ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms);
}

// 错误码 4xxxx 兼职段（API 规范 §3）：40001 岗位不存在 / 40002 重复报名 / 40003 已下架 / 40004 状态非法流转 / 40005 不能评价
@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly notification: NotificationService,
  ) {}

  // 商家发岗：需 Merchant APPROVED。创建 PENDING 草稿；发布由 feat/payment 负责（付费后置 PUBLISHED + expireAt）
  async createPost(merchantUid: string, dto: CreateJobPostDto, openid?: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || merchant.status !== MerchantStatus.APPROVED) {
      throw new BizException(60003, '商家资质未审核通过，不能发岗', HttpStatus.FORBIDDEN);
    }
    await Promise.all([
      this.moderation.checkText(dto.title, openid),
      this.moderation.checkText(dto.description, openid),
      this.moderation.checkText(dto.salary, openid),
      this.moderation.checkText(dto.location, openid),
    ]);

    const days = dto.duration === JobDuration.D90 ? 90 : 30;
    const expireAt = new Date(Date.now() + days * 86_400_000);
    const post = await this.prisma.jobPost.create({
      data: {
        merchantId: merchant.id,
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements ?? null,
        salary: dto.salary,
        salaryAmount: this.parseSalaryAmount(dto.salary),
        location: dto.location,
        category: dto.category,
        settlement: dto.settlement,
        workDates: this.filterWhitelist(dto.workDates, WORK_DATE_VALUES),
        workPeriods: this.filterWhitelist(dto.workPeriods, WORK_PERIOD_VALUES),
        headcount: dto.headcount ?? 1,
        urgent: dto.urgent ?? false,
        online: dto.online ?? false,
        questions: dto.questions ?? [],
        duration: dto.duration,
        expireAt,
        status: JobPostStatus.PENDING,
      },
      include: { merchant: { select: { shopName: true } } },
    });

    // 发布由 feat/payment 负责（付费后置 PUBLISHED + expireAt）；此处保持 PENDING 草稿
    return this.toPostVo(await this.refreshPost(post.id));
  }

  // M3-04 编辑岗位：商家可编辑未下架且属于自己的岗位（PENDING / PUBLISHED 可编辑，TAKEN_DOWN / EXPIRED 不可编辑）；
  // PUBLISHED 编辑后回退为 PENDING（需重新付费发布）；duration 不可改（影响支付与 expireAt）。
  async updatePost(merchantUid: string, postId: string, dto: UpdateJobPostDto, openid?: string) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id: postId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.deletedAt) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND); // M3-07 软删过滤
    if (post.merchant.userId !== merchantUid) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
    if (post.status === JobPostStatus.TAKEN_DOWN || post.status === JobPostStatus.EXPIRED) {
      throw new BizException(40003, '已下架或已过期岗位不可编辑', HttpStatus.CONFLICT);
    }

    // 内容安全审核（仅校验有改动的文本字段）
    const texts = [dto.title, dto.description, dto.salary, dto.location].filter((t): t is string => !!t);
    await Promise.all(texts.map((t) => this.moderation.checkText(t, openid)));

    // 组装更新数据（只写入 dto 提供的字段）
    const data: Prisma.JobPostUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.requirements !== undefined) data.requirements = dto.requirements || null;
    if (dto.salary !== undefined) {
      data.salary = dto.salary;
      data.salaryAmount = this.parseSalaryAmount(dto.salary);
    }
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.settlement !== undefined) data.settlement = dto.settlement;
    if (dto.workDates !== undefined) data.workDates = this.filterWhitelist(dto.workDates, WORK_DATE_VALUES);
    if (dto.workPeriods !== undefined) data.workPeriods = this.filterWhitelist(dto.workPeriods, WORK_PERIOD_VALUES);
    if (dto.headcount !== undefined) data.headcount = dto.headcount;
    if (dto.urgent !== undefined) data.urgent = dto.urgent;
    if (dto.online !== undefined) data.online = dto.online;
    if (dto.questions !== undefined) data.questions = dto.questions;

    // PUBLISHED 编辑后回退 PENDING（需重新付费发布）
    const wasPublished = post.status === JobPostStatus.PUBLISHED;
    if (wasPublished) {
      data.status = JobPostStatus.PENDING;
    }

    const updated = await this.prisma.jobPost.update({
      where: { id: postId },
      data,
      include: { merchant: { select: { shopName: true } } },
    });
    const vo = this.toPostVo(updated);
    vo.editedFromStatus = post.status;
    vo.needsRepublish = wasPublished;
    return vo;
  }

  // M3-05 主动下架岗位：仅 PUBLISHED 可下架（PENDING 是草稿无需下架；TAKEN_DOWN/EXPIRED 幂等报错）；保留下架时间。
  async takeDownPost(merchantUid: string, postId: string) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id: postId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.deletedAt) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND); // M3-07 软删过滤
    if (post.merchant.userId !== merchantUid) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
    if (post.status !== JobPostStatus.PUBLISHED) {
      throw new BizException(40004, `状态非法流转：${post.status} -> TAKEN_DOWN`, HttpStatus.CONFLICT);
    }
    const now = new Date();
    const updated = await this.prisma.jobPost.update({
      where: { id: postId },
      data: { status: JobPostStatus.TAKEN_DOWN, takenDownAt: now },
      include: { merchant: { select: { shopName: true } } },
    });
    return this.toPostVo(updated);
  }

  // M3-07 商家硬删草稿：仅 PENDING 状态可删（其它走下架）；软删字段 deletedAt=now；list/get 全链路过滤 deletedAt:null。
  async deletePost(merchantUid: string, postId: string) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id: postId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post || post.deletedAt) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.merchant.userId !== merchantUid) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
    if (post.status !== JobPostStatus.PENDING) {
      throw new BizException(40004, `状态非法流转：${post.status} -> DELETED（非 PENDING 草稿请走下架）`, HttpStatus.CONFLICT);
    }
    await this.prisma.jobPost.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  // M3-07 单岗位数据（曝光/报名/转化率 + 时间范围）：商家仅可查自己岗位；
  // exposureCount 复用 JobView.count（schema 无独立曝光字段，文案与数据偏差已在计划登记）；
  // 不过滤 deletedAt（保留历史数据）：所有权校验用 inline 实现，跳过 assertOwnsPost 的 deletedAt 检查。
  async getPostStats(
    merchantUid: string,
    postId: string,
    range: 'day' | 'week' | 'month' | 'all' | string = 'all',
  ) {
    // 非法 range 回退 all（与 plan §Step 3 一致：range=day|week|month|all，非法值回退 all）
    const safeRange: 'day' | 'week' | 'month' | 'all' =
      range === 'day' || range === 'week' || range === 'month' || range === 'all' ? range : 'all';
    const post = await this.prisma.jobPost.findUnique({
      where: { id: postId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.merchant.userId !== merchantUid) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
    // 注意：post.deletedAt 不做 40001 拦截（保留历史 stats）
    const since = rangeToSince(safeRange);
    const baseWhere = since
      ? { jobPostId: postId, createdAt: { gte: since } }
      : { jobPostId: postId };
    const [exposureCount, total, accepted, completed] = await Promise.all([
      this.prisma.jobView.count({ where: baseWhere }),
      this.prisma.jobApplication.count({ where: baseWhere }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: AppStatus.ACCEPTED } }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: AppStatus.DONE } }),
    ]);
    return {
      exposureCount,
      applicationCount: total,
      conversionRate: total > 0 ? Math.round(((accepted + completed) / total) * 100) : 0,
      range: safeRange,
    };
  }

  // 岗位列表：mine=1 商家自己的（含草稿）；否则 PUBLISHED 且未过期
  async listPosts(uid: string, q: JobListQueryDto) {
    const limit = Math.min(50, q.limit ?? 20);
    const where: Prisma.JobPostWhereInput = { deletedAt: null }; // M3-07 全链路过滤软删
    if (q.mine === 1) {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
      if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
      where.merchantId = merchant.id;
      // M3-03 商家岗位状态筛选（仅 mine 模式生效；公开列表硬约束 PUBLISHED+未过期）
      if (q.status) where.status = q.status as JobPostStatus;
    } else {
      where.status = JobPostStatus.PUBLISHED;
      where.expireAt = { gt: new Date() };
    }
    // P0-17 急招过滤（急招 tab）
    if (q.urgent === 1) where.urgent = true;
    // P0-18 筛选：关键词 / 分类 / 结算 / 地点 / 薪资范围 / 可线上
    const kw = q.keyword?.trim();
    if (kw) {
      where.OR = [
        { title: { contains: kw, mode: 'insensitive' } },
        { description: { contains: kw, mode: 'insensitive' } },
      ];
    }
    if (q.category) where.category = q.category as JobCategory;
    if (q.settlement) where.settlement = q.settlement as Settlement;
    if (q.location?.trim()) {
      where.location = { contains: q.location.trim(), mode: 'insensitive' };
    }
    if (q.online === 1) where.online = true;
    if (q.salaryMin !== undefined || q.salaryMax !== undefined) {
      const f: { gte?: number; lte?: number } = {};
      if (q.salaryMin !== undefined) f.gte = q.salaryMin;
      if (q.salaryMax !== undefined) f.lte = q.salaryMax;
      where.salaryAmount = f;
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

    // M3-06 mine 模式：每岗附带待处理报名数（独立 groupBy，避免 N+1）
    let pendingMap = new Map<string, number>();
    if (q.mine === 1 && slice.length > 0) {
      const groups = await this.prisma.jobApplication.groupBy({
        by: ['jobPostId'],
        where: { jobPostId: { in: slice.map((p) => p.id) }, status: AppStatus.PENDING },
        _count: { _all: true },
      });
      pendingMap = new Map(groups.map((g) => [g.jobPostId, g._count._all]));
    }

    return {
      list: slice.map((p) => ({
        ...this.toPostVo(p),
        pendingApplicationCount: q.mine === 1 ? pendingMap.get(p.id) ?? 0 : undefined,
      })),
      nextCursor,
      hasMore,
    };
  }

  async getPost(id: string) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id },
      include: { merchant: { select: { shopName: true } } },
    });
    if (!post || post.deletedAt) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND); // M3-07 软删过滤
    return this.toPostVo(post);
  }

  // P2-16 记录浏览事件（用于商家看板统计）
  async recordView(uid: string, postId: string) {
    const post = await this.prisma.jobPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    await this.prisma.jobView.create({ data: { jobPostId: postId, userId: uid } });
    return { recorded: true };
  }

  // P2-15 精品岗位列表（status=PUBLISHED + featured=true，按 featuredAt 倒序）
  async listFeatured(limit = 20) {
    const posts = await this.prisma.jobPost.findMany({
      where: { status: 'PUBLISHED', featured: true, expireAt: { gt: new Date() }, deletedAt: null }, // M3-07 软删过滤
      orderBy: [{ featuredAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(50, Math.max(1, limit)),
      include: { merchant: { select: { shopName: true } } },
    });
    return posts.map((p) => this.toPostVo(p));
  }

  // P2-16 商家招聘数据看板：浏览 / 报名 / 录用 / 完成 / 转化率 + 时间范围筛选
  async getMerchantDashboard(merchantUid: string, range: 'day' | 'week' | 'month' | 'all' = 'all') {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    const since = rangeToSince(range);
    const baseWhere = since
      ? { jobPost: { merchantId: merchant.id }, createdAt: { gte: since } }
      : { jobPost: { merchantId: merchant.id } };
    const [viewCount, total, pending, accepted, completed, rejected, cancelled] = await Promise.all([
      this.prisma.jobView.count({ where: baseWhere }),
      this.prisma.jobApplication.count({ where: baseWhere }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: 'PENDING' } }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: 'ACCEPTED' } }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: 'DONE' } }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      this.prisma.jobApplication.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
    ]);
    return {
      viewCount,
      applicationCount: total,
      pendingCount: pending,
      acceptedCount: accepted,
      completedCount: completed,
      rejectedCount: rejected,
      cancelledCount: cancelled,
      conversionRate: total > 0 ? Math.round(((accepted + completed) / total) * 100) : 0,
      range,
    };
  }

  // P0-19 举报岗位 -> 创建 ModerationRecord（targetType=job_post，管理员审核队列可见）；P1-27 记录举报人
  async report(uid: string, postId: string, reason?: string) {
    const post = await this.prisma.jobPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'job_post',
        targetId: postId,
        reason: reason ?? '用户举报',
        reporterId: uid,
      },
    });
    return { reported: true };
  }

  // P1-27 举报商家（targetType=merchant）
  async reportMerchant(uid: string, merchantId: string, reason?: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
    if (!merchant) throw new BizException(60002, '商家不存在', HttpStatus.NOT_FOUND);
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'merchant',
        targetId: merchantId,
        reason: reason ?? '用户举报商家',
        reporterId: uid,
      },
    });
    return { reported: true };
  }

  // P1-27 报名投诉（targetType=application；仅报名当事人：学生本人或岗位所属商家）
  async reportApplication(uid: string, appId: string, reason?: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { jobPost: { select: { merchantId: true, merchant: { select: { userId: true } } } } },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
    const isStudent = app.userId === uid;
    const isMerchant = app.jobPost.merchant?.userId === uid;
    if (!isStudent && !isMerchant) {
      throw new BizException(10003, '仅报名当事人可投诉', HttpStatus.FORBIDDEN);
    }
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'application',
        targetId: appId,
        reason: reason ?? '报名投诉',
        reporterId: uid,
      },
    });
    return { reported: true };
  }

  // 用户报名：防重（@@unique），岗位须 PUBLISHED 且未过期；P0-21 可附简历 + 回答问题
  async apply(uid: string, postId: string, dto: ApplyDto = {}) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id: postId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.status !== JobPostStatus.PUBLISHED) throw new BizException(40003, '岗位已下架');
    if (post.expireAt.getTime() < Date.now()) throw new BizException(40003, '岗位已过期');

    // P0-21 报名问题校验：有问题则必答且数量一致
    const questions = post.questions ?? [];
    let answersJson: { question: string; answer: string }[] | null = null;
    if (questions.length > 0) {
      const answers = dto.answers ?? [];
      if (answers.length !== questions.length || answers.some((a) => !a || !a.trim())) {
        throw new BizException(40006, '请完整回答报名问题', HttpStatus.BAD_REQUEST);
      }
      answersJson = questions.map((q, i) => ({ question: q, answer: answers[i]!.trim() }));
    }

    // P0-21 简历校验：如提供 resumeId 须为本人简历
    let resumeId: string | null = null;
    if (dto.resumeId) {
      const resume = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
      if (!resume || resume.userId !== uid) {
        throw new BizException(40006, '简历无效', HttpStatus.BAD_REQUEST);
      }
      resumeId = resume.id;
    }

    try {
      const app = await this.prisma.jobApplication.create({
        data: {
          jobPostId: postId,
          userId: uid,
          status: AppStatus.PENDING,
          resumeId,
          answers: answersJson ?? undefined,
        },
        include: { jobPost: { select: { title: true } } },
      });
      // 通知商家有新报名
      if (post.merchant) {
        await this.notification.create({
          userId: post.merchant.userId,
          type: NotificationType.JOB_APPLY,
          title: '新报名',
          content: '有新用户报名了你的岗位',
          targetType: 'job_post',
          targetId: postId,
        });
      }
      return this.toAppVo(app);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(40002, '已报名过该岗位', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }

  // 商家查某岗位报名（需岗位属于该商家）；P0-21 附带简历快照
  async listApplications(uid: string, postId: string) {
    await this.assertOwnsPost(uid, postId);
    const apps = await this.prisma.jobApplication.findMany({
      where: { jobPostId: postId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { nickname: true } }, jobPost: { select: { title: true } } },
    });
    const resumeIds = [...new Set(apps.map((a) => a.resumeId).filter((id): id is string => !!id))];
    const resumes =
      resumeIds.length > 0
        ? await this.prisma.resume.findMany({
            where: { id: { in: resumeIds } },
            select: { id: true, name: true, phone: true, selfIntro: true, skills: true },
          })
        : [];
    const resumeMap = new Map(resumes.map((r) => [r.id, r]));
    return apps.map((a) => this.toAppVo(a, a.resumeId ? (resumeMap.get(a.resumeId) ?? null) : null));
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

  // P1-23 用户取消未处理报名：仅 app.userId，仅 PENDING，PENDING -> CANCELLED；通知商家
  async cancel(uid: string, appId: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { jobPost: { select: { id: true, title: true, merchantId: true, merchant: { select: { userId: true } } } } },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
    if (app.userId !== uid) {
      throw new BizException(10003, '无权操作此报名', HttpStatus.FORBIDDEN);
    }
    if (app.status !== AppStatus.PENDING) {
      throw new BizException(40004, `状态非法流转：${app.status} -> CANCELLED`, HttpStatus.CONFLICT);
    }
    await this.prisma.jobApplication.update({ where: { id: appId }, data: { status: AppStatus.CANCELLED } });
    if (app.jobPost.merchant) {
      await this.notification.create({
        userId: app.jobPost.merchant.userId,
        type: NotificationType.JOB_APPLY, // 复用申请模板，content 区分
        title: '报名已取消',
        content: `用户已取消对岗位「${app.jobPost.title}」的报名`,
        targetType: 'job_post',
        targetId: app.jobPost.id,
      });
    }
    const refreshed = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { user: { select: { nickname: true } }, jobPost: { select: { title: true } } },
    });
    return this.toAppVo(refreshed!);
  }

  // 状态流转：accept(PENDING->ACCEPTED，商家) / reject(PENDING->REJECTED，商家) / complete(ACCEPTED->DONE，商家或学生)
  async transition(uid: string, appId: string, action: 'accept' | 'complete' | 'reject') {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { jobPost: { select: { id: true, merchantId: true, title: true } } },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);

    if (action === 'accept' || action === 'reject') {
      // 录用/拒绝：仅商家
      await this.assertOwnsPost(uid, app.jobPost.id);
      if (app.status !== AppStatus.PENDING) {
        const next = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
        throw new BizException(40004, `状态非法流转：${app.status} -> ${next}`, HttpStatus.CONFLICT);
      }
      if (action === 'accept') {
        await this.prisma.jobApplication.update({ where: { id: appId }, data: { status: AppStatus.ACCEPTED } });
        await this.notification.create({
          userId: app.userId,
          type: NotificationType.JOB_ACCEPT,
          title: '报名已录用',
          content: `商家已录用你对岗位「${app.jobPost.title}」的报名`,
          targetType: 'application',
          targetId: appId,
        });
      } else {
        // P1-24 未录用通知：站内通知 + 订阅消息模板路由已通
        await this.prisma.jobApplication.update({ where: { id: appId }, data: { status: AppStatus.REJECTED } });
        await this.notification.create({
          userId: app.userId,
          type: NotificationType.JOB_REJECT,
          title: '报名未录用',
          content: `商家未录用你对岗位「${app.jobPost.title}」的报名`,
          targetType: 'application',
          targetId: appId,
        });
      }
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
      await this.notification.create({
        userId: app.userId,
        type: NotificationType.JOB_COMPLETE,
        title: '岗位已完成',
        content: '商家已标记完成，可以去评价',
        targetType: 'application',
        targetId: appId,
      });
    }
    const refreshed = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { user: { select: { nickname: true } }, jobPost: { select: { title: true } } },
    });
    return this.toAppVo(refreshed!);
  }

  // P0-23 批量录用/拒绝（商家须拥有岗位；逐条复用 transition 校验，失败跳过并记录）
  async batchTransition(uid: string, postId: string, ids: string[], action: 'accept' | 'reject') {
    await this.assertOwnsPost(uid, postId);
    const results: Array<{ id: string; ok: boolean; status?: string; error?: string }> = [];
    for (const id of ids) {
      try {
        const r = await this.transition(uid, id, action);
        results.push({ id, ok: true, status: r.status });
      } catch (e) {
        results.push({ id, ok: false, error: (e as Error).message });
      }
    }
    return { processed: results };
  }

  // 评价：direction=stu_to_merchant 走原学生评商家路径（P1-25）；direction=merchant_to_stu 为商家评学生（P1-26）
  async review(uid: string, appId: string, dto: CreateReviewDto, openid?: string, direction = 'stu_to_merchant') {
    const isMerchantReview = direction === 'merchant_to_stu';
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { jobPost: { select: { id: true, merchantId: true, title: true } } },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
    if (isMerchantReview) {
      await this.assertOwnsPost(uid, app.jobPost.id);
    } else if (app.userId !== uid) {
      throw new BizException(10003, '无权评价', HttpStatus.FORBIDDEN);
    }
    if (app.status !== AppStatus.DONE) {
      throw new BizException(40005, '岗位未完成，不能评价', HttpStatus.CONFLICT);
    }
    await this.moderation.checkText(dto.content, openid);
    try {
      const r = await this.prisma.jobReview.create({
        data: {
          applicationId: appId,
          rating: dto.rating,
          content: dto.content,
          reviewerId: isMerchantReview ? uid : app.userId,
          direction,
        },
      });
      // 商家评完学生通知学生
      if (isMerchantReview) {
        await this.notification.create({
          userId: app.userId,
          type: NotificationType.JOB_REVIEW_FROM_MERCHANT,
          title: '商家已评价',
          content: `商家对你此次兼职「${app.jobPost.title}」给出了 ${dto.rating} 星评价`,
          targetType: 'application',
          targetId: appId,
        });
      }
      return this.toReviewVo(r, isMerchantReview ? uid : app.userId);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(40005, '已评价过', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }

  // 商家评学生：仅商家拥有岗位 + DONE + 未评过（应用 applicationId 唯一约束）
  async reviewByMerchant(uid: string, appId: string, dto: CreateReviewDto, openid?: string) {
    return this.review(uid, appId, dto, openid, 'merchant_to_stu');
  }

  async listReviews(postId: string) {
    const reviews = await this.prisma.jobReview.findMany({
      where: { application: { jobPostId: postId } },
      orderBy: { createdAt: 'desc' },
      include: {
        application: { select: { userId: true, user: { select: { nickname: true } } } },
      },
    });
    return reviews.map((r) => this.toReviewVo(r, r.application.userId));
  }

  // 推荐：基于用户最近报名的 location + 多样性打分；无历史退回按时间倒序 top 20
  async recommend(uid: string) {
    const RECENT_LIMIT = 5;
    const RESULT_LIMIT = 20;

    // 1) 取用户最近 5 个报名（含岗位 location）
    const recentApps = await this.prisma.jobApplication.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      include: { jobPost: { select: { location: true, merchantId: true } } },
    });

    // 2) 候选池：PUBLISHED 且未过期，按时间倒序，限 100 条（避免全表扫）
    const candidates = await this.prisma.jobPost.findMany({
      where: {
        status: JobPostStatus.PUBLISHED,
        expireAt: { gt: new Date() },
        deletedAt: null, // M3-07 软删过滤
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { merchant: { select: { shopName: true } } },
    });

    // 3) 无报名历史 → 退回按时间倒序 top RESULT_LIMIT
    if (recentApps.length === 0) {
      return candidates.slice(0, RESULT_LIMIT).map((p) => this.toPostVo(p));
    }

    // 4) 打分
    const recentLocations = new Set(
      recentApps.map((a) => a.jobPost?.location).filter((l): l is string => !!l),
    );
    const recentCities = new Set(
      recentApps
        .map((a) => a.jobPost?.location?.split(/[\s,，]/)[0])
        .filter((c): c is string => !!c && c.length > 0),
    );
    const recentMerchants = new Set(
      recentApps.map((a) => a.jobPost?.merchantId).filter((m): m is string => !!m),
    );

    const scored = candidates.map((p) => {
      let score = 0;
      if (recentLocations.has(p.location)) score += 5;
      const city = p.location.split(/[\s,，]/)[0];
      if (city && recentCities.has(city)) score += 3;
      if (!recentMerchants.has(p.merchantId)) score += 1;
      return { post: p, score };
    });

    // 5) 按 score desc + createdAt desc 排序，取 top RESULT_LIMIT
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.post.createdAt.getTime() - a.post.createdAt.getTime();
    });
    return scored.slice(0, RESULT_LIMIT).map((s) => this.toPostVo(s.post));
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
    if (!post || post.deletedAt) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND); // M3-07 软删过滤
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
    requirements: string | null;
    salary: string;
    salaryAmount: number | null;
    location: string;
    category: JobCategory | null;
    settlement: Settlement | null;
    workDates: string[];
    workPeriods: string[];
    headcount: number;
    urgent: boolean;
    featured?: boolean;
    online: boolean;
    questions: string[];
    duration: JobDuration;
    expireAt: Date;
    status: JobPostStatus;
    takenDownAt?: Date | null;
    deletedAt?: Date | null; // M3-07 软删字段
    createdAt: Date;
    merchant?: { shopName: string };
  }) {
    return {
      id: p.id,
      merchantId: p.merchantId,
      merchantShopName: p.merchant?.shopName ?? '',
      title: p.title,
      description: p.description,
      requirements: p.requirements,
      salary: p.salary,
      salaryAmount: p.salaryAmount,
      location: p.location,
      category: p.category,
      settlement: p.settlement,
      workDates: p.workDates,
      workPeriods: p.workPeriods,
      headcount: p.headcount,
      urgent: p.urgent,
      featured: p.featured ?? false,
      online: p.online,
      questions: p.questions,
      duration: p.duration,
      expireAt: p.expireAt.toISOString(),
      status: p.status,
      takenDownAt: p.takenDownAt ? p.takenDownAt.toISOString() : null,
      deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null, // M3-07 审计字段
      createdAt: p.createdAt.toISOString(),
      // M3-04 编辑返回扩展（仅 updatePost 设置）
      editedFromStatus: undefined as string | undefined,
      needsRepublish: undefined as boolean | undefined,
    };
  }

  // P0-17 工作日期/时段白名单过滤（结构化，丢弃非预设值）
  private filterWhitelist(input: string[] | undefined, allowed: readonly string[]): string[] {
    if (!input || input.length === 0) return [];
    const set = new Set<string>(allowed);
    return Array.from(new Set(input.filter((v) => set.has(v))));
  }

  // P0-18 从薪资字符串解析数额（取首个整数；"面议"/无数字返 null。单位差异为已知限制）
  private parseSalaryAmount(salary: string): number | null {
    const m = salary.match(/\d+/);
    if (!m) return null;
    const n = parseInt(m[0]!, 10);
    return Number.isFinite(n) ? n : null;
  }

  private toAppVo(
    a: {
      id: string;
      jobPostId: string;
      userId: string;
      resumeId: string | null;
      answers: unknown;
      status: AppStatus;
      createdAt: Date;
      user?: { nickname: string };
      jobPost?: { title: string };
    },
    resume: { name: string; phone: string; selfIntro: string | null; skills: string[] } | null = null,
  ) {
    return {
      id: a.id,
      jobPostId: a.jobPostId,
      jobPostTitle: a.jobPost?.title ?? '',
      userId: a.userId,
      userNickname: a.user?.nickname ?? '',
      resumeId: a.resumeId,
      answers: a.answers,
      // P0-21 简历快照（商家查看报名时展示）
      resume: resume ? { name: resume.name, phone: resume.phone, selfIntro: resume.selfIntro, skills: resume.skills } : null,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    };
  }

  // P0-21 我的简历（一人一份）；P1-21 附完整度 + 缺失字段
  async getMyResume(uid: string) {
    const r = await this.prisma.resume.findUnique({ where: { userId: uid } });
    return r ? this.toResumeVo(r) : null;
  }

  async upsertResume(uid: string, dto: UpsertResumeDto) {
    const data = {
      name: dto.name,
      phone: dto.phone,
      selfIntro: dto.selfIntro ?? null,
      skills: dto.skills ?? [],
      availabilities: dto.availabilities ?? [],
      experience: dto.experience ?? null,
    };
    const r = await this.prisma.resume.upsert({
      where: { userId: uid },
      update: data,
      create: { userId: uid, ...data },
    });
    return this.toResumeVo(r);
  }

  // P1-22 简历投递记录：该用户所有报名（投递）含岗位标题 + 商家名 + 状态 + 是否附简历
  async listResumeApplications(uid: string) {
    const apps = await this.prisma.jobApplication.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      include: { jobPost: { select: { id: true, title: true, merchant: { select: { shopName: true } } } } },
    });
    return apps.map((a) => ({
      id: a.id,
      jobPostId: a.jobPost.id,
      jobPostTitle: a.jobPost.title,
      merchantShopName: a.jobPost.merchant?.shopName ?? '',
      status: a.status,
      hasResume: !!a.resumeId,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  private toResumeVo(r: {
    id: string;
    name: string;
    phone: string;
    selfIntro: string | null;
    skills: string[];
    availabilities: string[];
    experience: string | null;
    updatedAt: Date;
  }) {
    // P1-21 完整度：6 个核心字段，每个约 16.7%，filled/6*100 取整
    const fields: Array<{ key: keyof typeof r; label: string; filled: boolean }> = [
      { key: 'name', label: '姓名', filled: !!r.name?.trim() },
      { key: 'phone', label: '联系方式', filled: !!r.phone?.trim() },
      { key: 'selfIntro', label: '自我介绍', filled: !!r.selfIntro?.trim() },
      { key: 'skills', label: '技能', filled: r.skills.length > 0 },
      { key: 'availabilities', label: '空闲时间', filled: r.availabilities.length > 0 },
      { key: 'experience', label: '工作经历', filled: !!r.experience?.trim() },
    ];
    const filledCount = fields.filter((f) => f.filled).length;
    const completeness = Math.round((filledCount / fields.length) * 100);
    const missingFields = fields.filter((f) => !f.filled).map((f) => f.label);
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      selfIntro: r.selfIntro,
      skills: r.skills,
      availabilities: r.availabilities,
      experience: r.experience,
      completeness,
      missingFields,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toReviewVo(r: { id: string; applicationId: string; rating: number; content: string; createdAt: Date; direction?: string }, reviewerId: string) {
    return {
      id: r.id,
      applicationId: r.applicationId,
      reviewerId,
      direction: r.direction ?? 'stu_to_merchant',
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
