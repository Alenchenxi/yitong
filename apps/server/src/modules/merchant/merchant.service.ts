import {
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppStatus, FitMark, InterviewInvitationStatus, MerchantStatus, Prisma, Role } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import type {
  BatchMarkDto,
  ListCandidatesDto,
  ListViewersDto,
  MarkContactedDto,
  MarkFitDto,
} from './dto/list-candidates.dto';
import type { RegisterMerchantDto } from './dto/register-merchant.dto';
import type { ReapplyMerchantDto } from './dto/reapply-merchant.dto';
import type { UpdateMerchantDto } from './dto/update-merchant.dto';

// 错误码 6xxxx 商家段（API 规范 §3 未列，新增）：
//   60001 已入驻 / 60002 未入驻 / 60003 未审核通过
//   60005 当前状态非 REJECTED，无法重新申请（商家驳回后重新提交守卫）
@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  // M4-02 报名处理提醒（懒检查版）静态规则：平台配置
  private static readonly STALE_THRESHOLD_HOURS = 24; // 未联系 + PENDING 超过该时长（小时）视为未及时处理
  private static readonly REMINDER_COOLDOWN_HOURS = 24; // 同一商家该冷却窗内最多一条提醒，防刷屏

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  // M4-02 报名处理提醒（懒检查）：商家进消息页时前端调用。扫超时未联系 PENDING 报名，
  // 若存在且冷却窗内未提醒过，创建一条站内提醒通知（type=job_apply_reminder，归 M4-01 apply 分类）。
  // 规则静态配置（STALE_THRESHOLD_HOURS / REMINDER_COOLDOWN_HOURS）；不授权微信订阅也不影响站内消息。
  async checkApplyReminder(merchantUid: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || merchant.status !== MerchantStatus.APPROVED) {
      return { created: false, count: 0 };
    }
    const staleBefore = new Date(Date.now() - MerchantService.STALE_THRESHOLD_HOURS * 3_600_000);
    const count = await this.prisma.jobApplication.count({
      where: {
        status: AppStatus.PENDING,
        contactedAt: null,
        createdAt: { lt: staleBefore },
        jobPost: { merchantId: merchant.id },
      },
    });
    if (count === 0) return { created: false, count: 0 };

    // 冷却：冷却窗内已有提醒则跳过，防刷屏
    const cooldownBefore = new Date(Date.now() - MerchantService.REMINDER_COOLDOWN_HOURS * 3_600_000);
    const recent = await this.prisma.notification.findFirst({
      where: {
        userId: merchantUid,
        type: NotificationType.JOB_APPLY_REMINDER,
        createdAt: { gt: cooldownBefore },
      },
      select: { id: true },
    });
    if (recent) return { created: false, count };

    await this.notification.create({
      userId: merchantUid,
      type: NotificationType.JOB_APPLY_REMINDER,
      title: '报名处理提醒',
      content: `您有 ${count} 个报名待处理超过 ${MerchantService.STALE_THRESHOLD_HOURS} 小时，请尽快查看候选人。`,
      targetType: 'merchant_candidates',
      targetId: merchant.id,
    });
    this.logger.log(`M4-02 apply reminder created for merchant ${merchantUid}: ${count} stale apps`);
    return { created: true, count };
  }

  // 入驻：创建 Merchant(PENDING)。dev 模式自动审核通过 + 加 MERCHANT 角色（方便测试）；
  // 生产等 feat/admin 审核（approveInternal 由 admin 调用）。
  async register(uid: string, dto: RegisterMerchantDto) {
    const existing = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (existing) throw new BizException(60001, '已入驻，不能重复申请');
    const m = await this.prisma.merchant.create({
      data: {
        userId: uid,
        shopName: dto.shopName,
        licenseNo: dto.licenseNo,
        contactPhone: dto.contactPhone,
        status: MerchantStatus.PENDING,
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn('dev mode: auto-approve merchant + grant MERCHANT role');
      await this.approveInternal(uid);
    }
    const refreshed = await this.prisma.merchant.findUnique({ where: { id: m.id } });
    return this.toVo(refreshed!);
  }

  // 商家驳回后重新提交资质：要求 status===REJECTED，写回三字段并置回 PENDING，写一条 ModerationRecord。
  // 注意：与 register() 不同，**不**调 approveInternal——dev 模式也不自动过审，否则绕过 60005 守卫
  // 让管理员永远看不到 PENDING 状态。MERCHANT 角色仅在 admin 审批通过时恢复。
  // 不重置 createdAt：语义是「首次入驻时间」，重新提交只是 ModerationRecord 上的事件。
  async reapply(uid: string, dto: ReapplyMerchantDto) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    if (m.status !== MerchantStatus.REJECTED) {
      throw new BizException(60005, '当前状态非 REJECTED，无法重新申请', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.merchant.update({
      where: { id: m.id },
      data: {
        shopName: dto.shopName,
        licenseNo: dto.licenseNo,
        contactPhone: dto.contactPhone,
        status: MerchantStatus.PENDING,
      },
    });
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'merchant',
        targetId: m.id,
        reason: '商家重新提交审核',
        status: 'PENDING',
        // reviewerId 留空：商家自提交非审核动作
      },
    });
    this.logger.log(`merchant reapply uid=${uid} merchantId=${m.id} -> PENDING`);
    return this.toVo(updated);
  }

  async getProfile(uid: string) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    // 取最近一条 REJECTED ModerationRecord 的 reason，前端用于驳回原因展示
    const rejectRow = await this.prisma.moderationRecord.findFirst({
      where: { targetType: 'merchant', targetId: m.id, status: 'REJECTED' },
      orderBy: { createdAt: 'desc' },
      select: { reason: true },
    });
    return this.toVoWithReason(m, rejectRow?.reason ?? null);
  }

  async updateProfile(uid: string, dto: UpdateMerchantDto) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.merchant.update({
      where: { userId: uid },
      data: {
        ...(dto.shopName ? { shopName: dto.shopName } : {}),
        ...(dto.contactPhone ? { contactPhone: dto.contactPhone } : {}),
      },
    });
    return this.toVo(updated);
  }

  // 商家评价列表（跨所有岗位）
  async getMerchantReviews(uid: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const posts = await this.prisma.jobPost.findMany({
      where: { merchantId: merchant.id },
      select: { id: true, title: true },
    });
    const postMap = new Map(posts.map((p) => [p.id, p.title]));
    if (posts.length === 0) return [];

    const reviews = await this.prisma.jobReview.findMany({
      where: { application: { jobPostId: { in: posts.map((p) => p.id) } } },
      orderBy: { createdAt: 'desc' },
      include: {
        application: {
          select: { userId: true, user: { select: { nickname: true } }, jobPostId: true },
        },
      },
    });
    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      jobPostTitle: postMap.get(r.application.jobPostId) ?? '',
      reviewerNickname: r.application.user?.nickname ?? '',
    }));
  }

  // M2-01 跨岗位候选人聚合：商家按岗位 / 状态 / 关键词分页查询自己所有岗位的报名候选人
  async listCandidates(uid: string, dto: ListCandidatesDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const keyword = dto.keyword?.trim();
    const where: Prisma.JobApplicationWhereInput = {
      jobPost: { merchantId: merchant.id },
      ...(dto.jobPostId ? { jobPostId: dto.jobPostId } : {}),
      ...(dto.status ? { status: dto.status as AppStatus } : {}),
      ...(dto.interviewStatus
        ? {
            AND: [
              { status: { in: [AppStatus.PENDING, AppStatus.ACCEPTED] } },
              { interviewInvitations: { some: { status: InterviewInvitationStatus.ACCEPTED } } },
            ],
          }
        : {}),
      // M2-04 已联系筛选：1=已联系(not null)，0=未联系(null)
      ...(dto.contacted !== undefined
        ? dto.contacted === 1
          ? { contactedAt: { not: null } }
          : { contactedAt: null }
        : {}),
      // M2-05 合适度筛选
      ...(dto.fitMark ? { fitMark: dto.fitMark as FitMark } : {}),
      ...(keyword
        ? {
            OR: [
              { user: { nickname: { contains: keyword, mode: 'insensitive' } } },
              { jobPost: { title: { contains: keyword, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const [total, apps] = await Promise.all([
      this.prisma.jobApplication.count({ where }),
      this.prisma.jobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true } },
          jobPost: { select: { title: true } },
          interviewInvitations: {
            where: { status: InterviewInvitationStatus.ACCEPTED },
            orderBy: [{ respondedAt: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              id: true,
              title: true,
              meetingDate: true,
              meetingTime: true,
              interviewerName: true,
              respondedAt: true,
            },
          },
        },
      }),
    ]);

    // 简历快照（与 job.service listApplications 同口径：name/phone/selfIntro/skills）
    const resumeIds = [...new Set(apps.map((a) => a.resumeId).filter((id): id is string => !!id))];
    const resumes =
      resumeIds.length > 0
        ? await this.prisma.resume.findMany({
            where: { id: { in: resumeIds } },
            select: { id: true, name: true, phone: true, selfIntro: true, skills: true },
          })
        : [];
    const resumeMap = new Map(resumes.map((r) => [r.id, r]));

    return {
      list: apps.map((a) => {
        const resume = a.resumeId ? (resumeMap.get(a.resumeId) ?? null) : null;
        const resumeSummary = this.resumeSummaryFromSnapshot(a.resumeSnapshot) ?? (resume
          ? { name: resume.name, phone: resume.phone, selfIntro: resume.selfIntro, skills: resume.skills }
          : null);
        return {
          id: a.id,
          jobPostId: a.jobPostId,
          jobPostTitle: a.jobPost?.title ?? '',
          userId: a.userId,
          userNickname: a.user?.nickname ?? '',
          resumeId: a.resumeId,
          resume: resumeSummary,
          status: a.status,
          // M2-04/05 标记字段
          contactedAt: a.contactedAt?.toISOString() ?? null,
          fitMark: a.fitMark,
          acceptedInterview: a.interviewInvitations[0]
            ? {
                ...a.interviewInvitations[0],
                respondedAt: a.interviewInvitations[0].respondedAt?.toISOString() ?? null,
              }
            : null,
          createdAt: a.createdAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  // M2-03 看过我：基于 JobView 展示看过商家岗位的用户（不接附近/地图）
  // 同一用户对同一岗位多次浏览只取最近一次，按最近浏览时间倒序
  async listViewers(uid: string, dto: ListViewersDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const postWhere: Prisma.JobPostWhereInput = { merchantId: merchant.id };
    if (dto.jobPostId) postWhere.id = dto.jobPostId;

    // 先拿到商家岗位 id 集合（用于过滤 JobView，并防传入他人岗位）
    const posts = await this.prisma.jobPost.findMany({
      where: postWhere,
      select: { id: true, title: true },
    });
    const postMap = new Map(posts.map((p) => [p.id, p.title]));
    if (posts.length === 0) return { list: [], total: 0, page: dto.page ?? 1, pageSize: dto.pageSize ?? 20 };

    const postIds = posts.map((p) => p.id);
    // 用 groupBy 取每个 (userId, jobPostId) 的最近浏览时间，再分页
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const grouped = await this.prisma.jobView.groupBy({
      by: ['userId', 'jobPostId'],
      where: { jobPostId: { in: postIds } },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.prisma.jobView.groupBy({
      by: ['userId', 'jobPostId'],
      where: { jobPostId: { in: postIds } },
      _max: { createdAt: true },
    });

    const userIds = [...new Set(grouped.map((g) => g.userId))];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nickname: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));

    // 是否也报名了该岗位（补全候选人来源信息）
    const appPairs = grouped.map((g) => ({ userId: g.userId, jobPostId: g.jobPostId }));
    const apps =
      appPairs.length > 0
        ? await this.prisma.jobApplication.findMany({
            where: { OR: appPairs },
            select: { userId: true, jobPostId: true, status: true },
          })
        : [];
    const appSet = new Set(apps.map((a) => `${a.userId}:${a.jobPostId}`));

    return {
      list: grouped.map((g) => ({
        userId: g.userId,
        userNickname: userMap.get(g.userId) ?? '',
        jobPostId: g.jobPostId,
        jobPostTitle: postMap.get(g.jobPostId) ?? '',
        viewedAt: (g._max.createdAt ?? new Date(0)).toISOString(),
        applied: appSet.has(`${g.userId}:${g.jobPostId}`),
      })),
      total: total.length,
      page,
      pageSize,
    };
  }

  // M2-04 标记已联系 / 清除（contacted=true 置 contactedAt，false 置 null）
  async markContacted(uid: string, appId: string, dto: MarkContactedDto) {
    const app = await this.assertOwnsApplication(uid, appId);
    const updated = await this.prisma.jobApplication.update({
      where: { id: appId },
      data: { contactedAt: dto.contacted ? new Date() : null },
    });
    return this.toMarkVo(updated, app.jobPostTitle);
  }

  // M2-05 标记合适/不合适 / 清除（fitMark=null 清除）
  async markFit(uid: string, appId: string, dto: MarkFitDto) {
    const app = await this.assertOwnsApplication(uid, appId);
    const updated = await this.prisma.jobApplication.update({
      where: { id: appId },
      data: { fitMark: dto.fitMark as FitMark | null },
    });
    return this.toMarkVo(updated, app.jobPostTitle);
  }

  // M2-06 批量标记已联系 / 合适度（逐条校验归属，不属于自己的跳过并记录）
  async batchMark(uid: string, dto: BatchMarkDto) {
    if (dto.mark === 'contacted' && dto.contacted === undefined) {
      throw new BizException(40000, 'mark=contacted 时需传 contacted', HttpStatus.BAD_REQUEST);
    }
    if (dto.mark === 'fit' && dto.fitMark === undefined) {
      throw new BizException(40000, 'mark=fit 时需传 fitMark', HttpStatus.BAD_REQUEST);
    }

    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const apps = await this.prisma.jobApplication.findMany({
      where: { id: { in: dto.ids } },
      include: { jobPost: { select: { merchantId: true, title: true } } },
    });

    const data =
      dto.mark === 'contacted'
        ? { contactedAt: dto.contacted ? new Date() : null }
        : { fitMark: (dto.fitMark as FitMark | null) ?? null };

    const results = await Promise.all(
      apps.map(async (a) => {
        if (a.jobPost.merchantId !== merchant.id) {
          return { id: a.id, ok: false, error: '无权操作该报名' };
        }
        await this.prisma.jobApplication.update({ where: { id: a.id }, data });
        return { id: a.id, ok: true };
      }),
    );
    return { processed: results };
  }

  // 校验报名归属当前商家，返回带岗位标题的报名
  private async assertOwnsApplication(uid: string, appId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: { jobPost: { select: { merchantId: true, title: true } } },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
    if (app.jobPost.merchantId !== merchant.id) {
      throw new BizException(10003, '无权操作此报名', HttpStatus.FORBIDDEN);
    }
    return { ...app, jobPostTitle: app.jobPost.title };
  }

  private toMarkVo(a: { id: string; contactedAt: Date | null; fitMark: FitMark | null }, jobPostTitle: string) {
    return {
      id: a.id,
      jobPostTitle,
      contactedAt: a.contactedAt?.toISOString() ?? null,
      fitMark: a.fitMark,
    };
  }

  // M2-07 候选人详情：简历 + 报名问题 + 岗位信息 + 处理记录（通知历史 + 当前标记）
  // 处理记录说明：状态流转来自通知表（JOB_ACCEPT/JOB_REJECT/JOB_COMPLETE），联系时间取 contactedAt；fitMark 仅当前态无历史故不入时间线
  async getCandidateDetail(uid: string, appId: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: appId },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true } },
        jobPost: {
          select: {
            id: true,
            merchantId: true,
            title: true,
            description: true,
            requirements: true,
            salary: true,
            location: true,
            category: true,
            settlement: true,
            workDates: true,
            workPeriods: true,
            headcount: true,
            urgent: true,
            online: true,
            questions: true,
            expireAt: true,
            status: true,
          },
        },
      },
    });
    if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);

    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    if (app.jobPost.merchantId !== merchant.id) {
      throw new BizException(10003, '无权查看此报名', HttpStatus.FORBIDDEN);
    }

    // 简历无 Prisma relation，需单独查
    const snapshotResume = this.resumeVoFromSnapshot(app.resumeSnapshot, app.resumeId, app.createdAt);
    const resumeRow = !snapshotResume && app.resumeId
      ? await this.prisma.resume.findUnique({ where: { id: app.resumeId } })
      : null;
    const resumeVo = snapshotResume ?? (resumeRow ? this.toResumeVo(resumeRow) : null);

    // 状态流转历史：商家发给学生的通知（JOB_ACCEPT/REJECT/COMPLETE），targetType=application, targetId=appId
    const statusNotifs = await this.prisma.notification.findMany({
      where: {
        targetType: 'application',
        targetId: appId,
        type: { in: [NotificationType.JOB_ACCEPT, NotificationType.JOB_REJECT, NotificationType.JOB_COMPLETE] },
      },
      orderBy: { createdAt: 'asc' },
      select: { type: true, createdAt: true },
    });

    const history: Array<{ type: 'STATUS' | 'CONTACT'; action: string; label: string; at: string }> = [
      { type: 'STATUS', action: 'APPLY', label: '提交报名', at: app.createdAt.toISOString() },
      ...statusNotifs.map((n) => {
        const label =
          n.type === NotificationType.JOB_ACCEPT
            ? '商家录用'
            : n.type === NotificationType.JOB_REJECT
              ? '商家未录用'
              : '商家标记完成';
        return { type: 'STATUS' as const, action: n.type, label, at: n.createdAt.toISOString() };
      }),
      ...(app.contactedAt
        ? [{ type: 'CONTACT' as const, action: 'CONTACT', label: '已标记联系', at: app.contactedAt.toISOString() }]
        : []),
    ];

    // 报名问题回答：answers 是 JSON（与 questions 顺序对齐）；统一成 [{question, answer}]
    const rawAnswers = app.answers;
    const answers: Array<{ question: string; answer: string }> | null = Array.isArray(rawAnswers)
      ? (rawAnswers as Array<{ question?: string; answer?: string }>).map((a, i) => ({
          question: a?.question ?? app.jobPost.questions?.[i] ?? `问题 ${i + 1}`,
          answer: a?.answer ?? '',
        }))
      : null;

    return {
      id: app.id,
      status: app.status,
      createdAt: app.createdAt.toISOString(),
      contactedAt: app.contactedAt?.toISOString() ?? null,
      fitMark: app.fitMark,
      user: app.user,
      jobPost: {
        ...app.jobPost,
        expireAt: app.jobPost.expireAt?.toISOString() ?? null,
      },
      resume: resumeVo,
      answers,
      history,
    };
  }

  // 简历完整度计算（与 job.service toResumeVo 同步口径）
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

  private resumeSummaryFromSnapshot(value: Prisma.JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const snapshot = value as Prisma.JsonObject;
    if (typeof snapshot.name !== 'string' || typeof snapshot.phone !== 'string') return null;
    return {
      name: snapshot.name,
      phone: snapshot.phone,
      selfIntro: typeof snapshot.selfIntro === 'string' ? snapshot.selfIntro : null,
      skills: Array.isArray(snapshot.skills)
        ? snapshot.skills.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }

  private resumeVoFromSnapshot(value: Prisma.JsonValue, resumeId: string | null, fallbackUpdatedAt: Date) {
    const summary = this.resumeSummaryFromSnapshot(value);
    if (!summary || !value || typeof value !== 'object' || Array.isArray(value)) return null;
    const snapshot = value as Prisma.JsonObject;
    const availabilities = Array.isArray(snapshot.availabilities)
      ? snapshot.availabilities.filter((item): item is string => typeof item === 'string')
      : [];
    const experience = typeof snapshot.experience === 'string' ? snapshot.experience : null;
    const fields = [
      !!summary.name.trim(),
      !!summary.phone.trim(),
      !!summary.selfIntro?.trim(),
      summary.skills.length > 0,
      availabilities.length > 0,
      !!experience?.trim(),
    ];
    const missingLabels = ['姓名', '联系方式', '自我介绍', '技能', '空闲时间', '工作经历'];
    return {
      id: resumeId ?? `snapshot-${fallbackUpdatedAt.getTime()}`,
      ...summary,
      availabilities,
      experience,
      completeness: Math.round((fields.filter(Boolean).length / fields.length) * 100),
      missingFields: missingLabels.filter((_, index) => !fields[index]),
      updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : fallbackUpdatedAt.toISOString(),
    };
  }

  // 商家订单记录（付费发布历史）
  async getMerchantOrders(uid: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const [orders, posts] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jobPost.findMany({
        where: { merchantId: merchant.id },
        select: { id: true, title: true },
      }),
    ]);
    const postMap = new Map(posts.map((p) => [p.id, p.title]));
    return orders.map((o) => ({
      id: o.id,
      jobPostId: o.jobPostId,
      jobPostTitle: postMap.get(o.jobPostId ?? '') ?? '',
      duration: o.duration,
      amount: o.amount.toString(),
      status: o.status,
      paidAt: o.paidAt?.toISOString() ?? null,
      refundedAt: o.refundedAt?.toISOString() ?? null,
      refundReason: o.refundReason,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  // 审核通过 helper：置 APPROVED + 给用户加 MERCHANT 角色。供 feat/admin 调用。
  async approveInternal(uid: string) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) return;
    if (m.status !== MerchantStatus.APPROVED) {
      await this.prisma.merchant.update({
        where: { id: m.id },
        data: { status: MerchantStatus.APPROVED },
      });
    }
    await this.prisma.userRole.upsert({
      where: { userId_role: { userId: uid, role: Role.MERCHANT } },
      update: {},
      create: { userId: uid, role: Role.MERCHANT },
    });
  }

  async rejectInternal(uid: string, _reason?: string) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) return;
    await this.prisma.merchant.update({
      where: { id: m.id },
      data: { status: MerchantStatus.REJECTED },
    });
    // 拒绝则移除 MERCHANT 角色
    await this.prisma.userRole.deleteMany({
      where: { userId: uid, role: Role.MERCHANT },
    });
  }

  private toVo(m: {
    id: string;
    userId: string;
    shopName: string;
    licenseNo: string;
    contactPhone: string;
    status: MerchantStatus;
    createdAt: Date;
  }) {
    return {
      id: m.id,
      userId: m.userId,
      shopName: m.shopName,
      licenseNo: m.licenseNo,
      contactPhone: m.contactPhone,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    };
  }

  // 带驳回原因的 VO 扩展：用于 GET /merchant/profile 返回值，供前端展示最近一次被拒原因
  private toVoWithReason(
    m: {
      id: string;
      userId: string;
      shopName: string;
      licenseNo: string;
      contactPhone: string;
      status: MerchantStatus;
      createdAt: Date;
    },
    lastRejectReason: string | null,
  ) {
    return { ...this.toVo(m), lastRejectReason };
  }
}
