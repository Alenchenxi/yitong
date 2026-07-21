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
import type { CreateJobPostDto, JobListQueryDto, CreateReviewDto, ApplyDto, UpsertResumeDto } from './dto/job.dto';

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

  // 岗位列表：mine=1 商家自己的（含草稿）；否则 PUBLISHED 且未过期
  async listPosts(uid: string, q: JobListQueryDto) {
    const limit = Math.min(50, q.limit ?? 20);
    const where: Prisma.JobPostWhereInput = {};
    if (q.mine === 1) {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
      if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
      where.merchantId = merchant.id;
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

  // P0-19 举报岗位 -> 创建 ModerationRecord（targetType=job_post，管理员审核队列可见）
  async report(postId: string, reason?: string) {
    const post = await this.prisma.jobPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'job_post',
        targetId: postId,
        reason: reason ?? '用户举报',
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
      // 通知报名者已录用
      await this.notification.create({
        userId: app.userId,
        type: NotificationType.JOB_ACCEPT,
        title: '报名已录用',
        content: '商家已录用你的报名',
        targetType: 'application',
        targetId: appId,
      });
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
      // 通知报名者岗位已完成
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
    online: boolean;
    questions: string[];
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
      online: p.online,
      questions: p.questions,
      duration: p.duration,
      expireAt: p.expireAt.toISOString(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
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

  // P0-21 我的简历（一人一份）
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
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      selfIntro: r.selfIntro,
      skills: r.skills,
      availabilities: r.availabilities,
      experience: r.experience,
      updatedAt: r.updatedAt.toISOString(),
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
