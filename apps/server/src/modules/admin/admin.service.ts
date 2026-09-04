import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BannerStatus, CommunityStatus, JobPostStatus, MerchantStatus, ModerationAuthority, ModerationStatus, PayScene, PayStatus, PostStatus, Prisma, PublicationScope, Role } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfessionService } from '../confession/confession.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import { TutorJobPolicyService } from '../tutor-sync/tutor-job-policy.service';
import {
  TUTOR_SYNC_DEFAULT_ENABLED,
  TUTOR_SYNC_DEFAULT_BATCH_SIZE,
  TUTOR_SYNC_ENABLED_KEY,
  TUTOR_SYNC_BATCH_SIZE_KEY,
  TUTOR_SYNC_MAX_BATCH_SIZE,
  TUTOR_SYNC_MIN_BATCH_SIZE,
  parseTutorSyncBatchSize,
} from '../tutor-sync/tutor-sync.settings';
import type { UpdateBoostPlanPriceDto } from './dto/update-boost-plan-price.dto';
import type { UpdatePricingDto } from './dto/update-pricing.dto';
import { ANONYMOUS_CONTENT_ENABLED_KEY } from '../app-config/app-config.service';
import { AdminAccessService, type AdminAccessContext } from './admin-access.service';
import {
  ADMIN_PERMISSION_CATALOG,
  normalizeAdminPermissionCodes,
} from './admin-permissions';
import type {
  CreateAdminTypeDto,
  UpdateAdminAssignmentDto,
  UpdateAdminTypeDto,
} from './dto/admin-type.dto';
import type { CreateAdminDto } from './dto/create-admin.dto';
import type { UpdateCommunityDto } from './dto/update-community.dto';
import type { ModerationScope } from './dto/moderation-context.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly confession: ConfessionService,
    private readonly notification: NotificationService,
    private readonly tutorJobPolicy: TutorJobPolicyService,
    private readonly accessService: AdminAccessService,
  ) {}

  // 商家审核队列。举报数据使用独立 report.manage 接口，避免跨权限泄露。
  async getQueue() {
    const merchants = await this.prisma.merchant.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    // R5 Merchant 模型无 user relation（仅 userId 标量），单独查 User 昵称再映射
    const userIds = [...new Set(merchants.map((m) => m.userId))];
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nickname: true } })
      : [];
    const nickMap = new Map(users.map((u) => [u.id, u.nickname]));
    return {
      merchants: merchants.map((m) => ({
        id: m.id,
        shopName: m.shopName,
        licenseNo: m.licenseNo,
        contactPhone: m.contactPhone,
        status: m.status,
        userId: m.userId,
        userNickname: nickMap.get(m.userId) ?? '',
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async getModerationContexts(access: AdminAccessContext) {
    const communities = await this.prisma.community.findMany({
      where: this.accessService.communityWhere(access),
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return {
      scopes: access.isPlatform
        ? [{ scope: 'PLATFORM' as const, label: '平台内容' }, { scope: 'COMMUNITY' as const, label: '圈子内容' }]
        : [{ scope: 'COMMUNITY' as const, label: '圈子内容' }],
      communities,
    };
  }

  private async resolveContentContext(
    access: AdminAccessContext,
    scope: ModerationScope | undefined,
    communityId?: string,
  ) {
    const resolvedScope = await this.accessService.assertModerationContext(access, scope, communityId);
    return {
      scope: resolvedScope,
      communityId: resolvedScope === 'COMMUNITY'
        ? (communityId ?? this.accessService.communityIdWhere(access))
        : undefined,
    };
  }

  // ===== C 帖子分页管理 =====
  async listPostsAdmin(
    page = 1,
    pageSize = 20,
    keyword: string | undefined,
    status: string | undefined,
    scope: ModerationScope | undefined,
    communityId: string | undefined,
    access: AdminAccessContext,
  ) {
    const context = await this.resolveContentContext(access, scope, communityId);
    const where: Prisma.PostWhereInput = { publisherScope: context.scope as PublicationScope };
    if (context.communityId) where.communityId = context.communityId;
    if (keyword?.trim()) where.content = { contains: keyword.trim(), mode: 'insensitive' };
    if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') where.status = status;
    const [list, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: { select: { nickname: true } }, circle: { select: { name: true } } },
      }),
      this.prisma.post.count({ where }),
    ]);
    return {
      list: list.map((p) => ({
        id: p.id,
        content: p.content,
        status: p.status,
        communityId: p.communityId,
        publisherScope: p.publisherScope,
        moderationAuthority: p.moderationAuthority,
        moderationVersion: p.moderationVersion,
        authorNickname: p.author?.nickname ?? '',
        circleName: p.circle?.name ?? '',
        pinned: p.pinned,
        featured: p.featured,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async listAnonPostsAdmin(
    page: number,
    pageSize: number,
    scope: ModerationScope | undefined,
    communityId: string | undefined,
    access: AdminAccessContext,
  ) {
    const context = await this.resolveContentContext(access, scope, communityId);
    const where: Prisma.AnonymousPostWhereInput = { publisherScope: context.scope as PublicationScope };
    if (context.communityId) where.communityId = context.communityId;
    const [list, total] = await Promise.all([
      this.prisma.anonymousPost.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.anonymousPost.count({ where }),
    ]);
    return {
      list: list.map((p) => ({
        id: p.id,
        content: p.content,
        anonId: p.anonId,
        status: p.status,
        communityId: p.communityId,
        publisherScope: p.publisherScope,
        moderationAuthority: p.moderationAuthority,
        moderationVersion: p.moderationVersion,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ===== F 评论管理（人工置顶，Comment.pinned 字段已有）=====

  // 评论分页（可按 postId/authorId 精确 + keyword 内容/authorNickname 用户昵称/postTitleKw 帖子内容模糊）
  // 精确筛选（postId/authorId）与模糊筛选（postTitleKw/authorNickname）互斥：传精确则忽略模糊
  async listCommentsAdmin(
    postId?: string,
    page = 1,
    pageSize = 20,
    keyword?: string,
    authorId?: string,
    authorNickname?: string,
    postTitleKw?: string,
    access?: AdminAccessContext,
  ) {
    const where: Prisma.CommentWhereInput = {};
    if (access && !access.isPlatform) {
      where.post = {
        publisherScope: PublicationScope.COMMUNITY,
        communityId: this.accessService.communityIdWhere(access),
      };
    }
    if (postId) {
      where.postId = postId;
    } else if (postTitleKw?.trim()) {
      const posts = await this.prisma.post.findMany({
        where: { content: { contains: postTitleKw.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      const ids = posts.map((p) => p.id);
      if (ids.length === 0) return { list: [], total: 0, page, pageSize };
      where.postId = { in: ids };
    }
    if (authorId) {
      where.authorId = authorId;
    } else if (authorNickname?.trim()) {
      const authors = await this.prisma.user.findMany({
        where: { nickname: { contains: authorNickname.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      const ids = authors.map((a) => a.id);
      if (ids.length === 0) return { list: [], total: 0, page, pageSize };
      where.authorId = { in: ids };
    }
    if (keyword?.trim()) where.content = { contains: keyword.trim(), mode: 'insensitive' };
    const [list, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { post: { select: { id: true, content: true } } },
      }),
      this.prisma.comment.count({ where }),
    ]);
    return {
      list: list.map((c) => ({
        id: c.id,
        content: c.content,
        postId: c.postId,
        postTitle: c.post?.content.slice(0, 20) ?? '',
        likeCount: c.likeCount,
        pinned: c.pinned,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // 人工置顶/取消置顶评论 + 留痕
  async pinComment(id: string, reviewerId: string, pinned: boolean, access?: AdminAccessContext) {
    const c = await this.prisma.comment.findUnique({
      where: { id },
      include: { post: { select: { publisherScope: true, communityId: true } } },
    });
    if (!c) throw new BizException(40001, '评论不存在', HttpStatus.NOT_FOUND);
    if (access) await this.accessService.assertModerationTarget(access, c.post.publisherScope, c.post.communityId);
    await this.prisma.comment.update({ where: { id }, data: { pinned } });
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'comment',
        targetId: id,
        reason: pinned ? '管理员置顶评论' : '取消置顶评论',
        status: 'APPROVED',
        reviewerId,
      },
    });
    return { id, pinned };
  }

  // ===== P1-28 举报处理队列 =====

  // 举报列表（含举报人昵称 + 目标摘要，分页 + 状态筛选）
  async listReports(
    status?: string,
    page = 1,
    pageSize = 20,
    access?: AdminAccessContext,
    scope?: ModerationScope,
    communityId?: string,
  ) {
    const where: Prisma.ModerationRecordWhereInput = { reporterId: { not: null } };
    if (access && (scope !== undefined || !access.isPlatform)) {
      const context = await this.resolveContentContext(access, scope, communityId);
      where.targetPublisherScope = context.scope as PublicationScope;
      if (context.communityId) where.targetCommunityId = context.communityId;
    }
    if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') {
      where.status = status;
    }
    const [list, total] = await Promise.all([
      this.prisma.moderationRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.moderationRecord.count({ where }),
    ]);
    // 批量取举报人昵称
    const reporterIds = [...new Set(list.map((r) => r.reporterId).filter((x): x is string => !!x))];
    const reporters = reporterIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, nickname: true } })
      : [];
    const reporterMap = new Map(reporters.map((u) => [u.id, u.nickname]));
    // 目标摘要（按类型分别批量取）
    const summaries = await this.buildTargetSummaries(list);
    return {
      list: list.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        targetSummary: summaries.get(`${r.targetType}:${r.targetId}`) ?? '',
        reason: r.reason,
        status: r.status,
        result: r.result,
        reporterId: r.reporterId,
        reporterNickname: r.reporterId ? (reporterMap.get(r.reporterId) ?? '') : '',
        reviewerId: r.reviewerId,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  private async buildTargetSummaries(records: Array<{ targetType: string; targetId: string }>) {
    const map = new Map<string, string>();
    const byType = (t: string) => records.filter((r) => r.targetType === t).map((r) => r.targetId);
    const postIds = byType('job_post');
    if (postIds.length) {
      const posts = await this.prisma.jobPost.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } });
      for (const p of posts) map.set(`job_post:${p.id}`, `岗位「${p.title}」`);
    }
    const merchantIds = byType('merchant');
    if (merchantIds.length) {
      const merchants = await this.prisma.merchant.findMany({ where: { id: { in: merchantIds } }, select: { id: true, shopName: true } });
      for (const m of merchants) map.set(`merchant:${m.id}`, `商家「${m.shopName}」`);
    }
    const appIds = byType('application');
    if (appIds.length) {
      const apps = await this.prisma.jobApplication.findMany({
        where: { id: { in: appIds } },
        select: { id: true, jobPost: { select: { title: true } }, user: { select: { nickname: true } } },
      });
      for (const a of apps) map.set(`application:${a.id}`, `报名「${a.jobPost.title} · ${a.user.nickname}」`);
    }
    const confessionIds = byType('post');
    if (confessionIds.length) {
      const posts = await this.prisma.post.findMany({ where: { id: { in: confessionIds } }, select: { id: true, content: true } });
      for (const p of posts) map.set(`post:${p.id}`, `表白墙帖「${p.content.slice(0, 20)}」`);
    }
    return map;
  }

  // 处理举报：approve=成立（可选下架目标），reject=驳回；通知举报人
  async resolveReport(
    id: string,
    reviewerId: string,
    dto: { action: 'approve' | 'reject'; result?: string; takedown?: boolean },
    access?: AdminAccessContext,
  ) {
    const record = await this.prisma.moderationRecord.findUnique({ where: { id } });
    if (!record) throw new BizException(40001, '举报记录不存在', HttpStatus.NOT_FOUND);
    if (access) await this.assertReportTargetAccess(record.targetType, record.targetId, access);
    if (record.status !== 'PENDING') {
      throw new BizException(40004, `举报已处理（${record.status}），不能重复处理`, HttpStatus.CONFLICT);
    }
    const approved = dto.action === 'approve';
    const resolvedStatus = approved ? ModerationStatus.APPROVED : ModerationStatus.REJECTED;
    const resolutionData = {
      status: resolvedStatus,
      result: dto.result ?? (approved ? '举报成立' : '举报未通过核实'),
      reviewerId,
      resolvedAt: new Date(),
    };
    let didTakedown = false;
    let jobMerchantUserId: string | null = null;
    let contentAuthorUserId: string | null = null;

    if (approved && record.targetType === 'job_post' && dto.takedown === true) {
      let authority: ModerationAuthority | undefined;
      const target = await this.prisma.jobPost.findUnique({
        where: { id: record.targetId },
        select: { publisherScope: true, communityId: true, moderationAuthority: true },
      });
      if (!target) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
      if (access) {
        authority = await this.accessService.assertModerationTarget(access, target.publisherScope, target.communityId);
        this.assertNoAuthorityDowngrade(target.moderationAuthority, authority);
      }
      const outcome = await this.prisma.$transaction(async (tx) => {
        const blockedAt = new Date();
        const shouldTakedown = await this.tutorJobPolicy.takeDownJobPostWithGuard(
          tx,
          record.targetId,
          blockedAt,
          { requireTutorBinding: false, publishedOnly: true },
        );
        const resolution = await tx.moderationRecord.updateMany({
          where: { id, status: 'PENDING' },
          data: resolutionData,
        });
        if (resolution.count !== 1) {
          throw new BizException(40004, '举报已被其他管理员处理', HttpStatus.CONFLICT);
        }
        if (!shouldTakedown) return { didTakedown: false, merchantUserId: null };
        if (authority) {
          await tx.jobPost.update({
            where: { id: record.targetId },
            data: { moderationAuthority: authority, moderationVersion: { increment: 1 } },
          });
        }
        const post = await tx.jobPost.findUnique({
          where: { id: record.targetId },
          select: { merchant: { select: { userId: true } } },
        });
        return { didTakedown: true, merchantUserId: post?.merchant?.userId ?? null };
      });
      didTakedown = outcome.didTakedown;
      jobMerchantUserId = outcome.merchantUserId;
    } else if (approved && record.targetType === 'post' && dto.takedown === true) {
      const target = await this.prisma.post.findUnique({ where: { id: record.targetId } });
      if (!target) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
      const authority = access
        ? await this.accessService.assertModerationTarget(access, target.publisherScope, target.communityId)
        : ModerationAuthority.PLATFORM;
      this.assertNoAuthorityDowngrade(target.moderationAuthority, authority);
      if (target.status === PostStatus.REJECTED) {
        throw new BizException(40004, '内容已下架，请刷新后重试', HttpStatus.CONFLICT);
      }
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.post.updateMany({
          where: { id: target.id, status: target.status, moderationVersion: target.moderationVersion },
          data: {
            status: PostStatus.REJECTED,
            moderationAuthority: authority,
            moderationVersion: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
        }
        await tx.moderationRecord.create({
          data: {
            targetType: 'post',
            targetId: target.id,
            reason: dto.result ?? '管理员下架',
            status: ModerationStatus.REJECTED,
            reviewerId,
          },
        });
        const resolution = await tx.moderationRecord.updateMany({
          where: { id, status: ModerationStatus.PENDING },
          data: resolutionData,
        });
        if (resolution.count !== 1) {
          throw new BizException(40004, '举报已被其他管理员处理', HttpStatus.CONFLICT);
        }
      });
      didTakedown = true;
      contentAuthorUserId = target.authorId;
      this.confession.invalidateFeedCache();
    } else if (approved && record.targetType === 'anon-post' && dto.takedown === true) {
      const target = await this.prisma.anonymousPost.findUnique({ where: { id: record.targetId } });
      if (!target) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
      const authority = access
        ? await this.accessService.assertModerationTarget(access, target.publisherScope, target.communityId)
        : ModerationAuthority.PLATFORM;
      this.assertNoAuthorityDowngrade(target.moderationAuthority, authority);
      if (target.status === PostStatus.REJECTED) {
        throw new BizException(40004, '内容已下架，请刷新后重试', HttpStatus.CONFLICT);
      }
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.anonymousPost.updateMany({
          where: { id: target.id, status: target.status, moderationVersion: target.moderationVersion },
          data: {
            status: PostStatus.REJECTED,
            moderationAuthority: authority,
            moderationVersion: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
        }
        await tx.moderationRecord.create({
          data: {
            targetType: 'anon-post',
            targetId: target.id,
            reason: dto.result ?? '管理员下架',
            status: ModerationStatus.REJECTED,
            reviewerId,
          },
        });
        const resolution = await tx.moderationRecord.updateMany({
          where: { id, status: ModerationStatus.PENDING },
          data: resolutionData,
        });
        if (resolution.count !== 1) {
          throw new BizException(40004, '举报已被其他管理员处理', HttpStatus.CONFLICT);
        }
      });
      didTakedown = true;
    } else {
      const resolution = await this.prisma.moderationRecord.updateMany({
        where: { id, status: ModerationStatus.PENDING },
        data: resolutionData,
      });
      if (resolution.count !== 1) {
        throw new BizException(40004, '举报已被其他管理员处理', HttpStatus.CONFLICT);
      }
    }

    if (contentAuthorUserId && contentAuthorUserId !== reviewerId) {
      void this.notification
        .create({
          userId: contentAuthorUserId,
          type: NotificationType.POST_TAKEDOWN,
          title: '表白墙 · 内容下架',
          content: dto.result ? `你的帖子已被管理员下架：${dto.result}` : '你的帖子已被管理员下架',
          targetType: 'post',
          targetId: record.targetId,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify takedown failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }

    if (jobMerchantUserId) {
      void this.notification
        .create({
          userId: jobMerchantUserId,
          type: NotificationType.POST_TAKEDOWN,
          title: '兼职 · 岗位下架',
          content: dto.result ? `你的岗位因举报被平台下架：${dto.result}` : '你的岗位因举报被平台下架',
          targetType: 'job_post',
          targetId: record.targetId,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify job takedown failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    // 通知举报人处理结果
    if (record.reporterId) {
      void this.notification
        .create({
          userId: record.reporterId,
          type: NotificationType.REPORT_RESULT,
          title: approved ? '举报 · 已受理' : '举报 · 未通过',
          content: approved
            ? `你的举报已核实处理${didTakedown ? '，相关内容已下架' : ''}${dto.result ? `：${dto.result}` : ''}`
            : `你的举报经核实不成立${dto.result ? `：${dto.result}` : ''}`,
          targetType: record.targetType,
          targetId: record.targetId,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify report result failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    return { id, status: resolvedStatus };
  }

  private async assertReportTargetAccess(targetType: string, targetId: string, access: AdminAccessContext) {
    if (access.isPlatform) return;
    if (targetType === 'post') {
      const target = await this.prisma.post.findUnique({ where: { id: targetId }, select: { publisherScope: true, communityId: true } });
      if (!target) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
      await this.accessService.assertModerationTarget(access, target.publisherScope, target.communityId);
      return;
    }
    if (targetType === 'anon-post') {
      const target = await this.prisma.anonymousPost.findUnique({ where: { id: targetId }, select: { publisherScope: true, communityId: true } });
      if (!target) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
      await this.accessService.assertModerationTarget(access, target.publisherScope, target.communityId);
      return;
    }
    if (targetType === 'job_post') {
      const target = await this.prisma.jobPost.findUnique({ where: { id: targetId }, select: { publisherScope: true, communityId: true } });
      if (!target) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
      await this.accessService.assertModerationTarget(access, target.publisherScope, target.communityId);
      return;
    }
    if (targetType === 'application') {
      const target = await this.prisma.jobApplication.findUnique({
        where: { id: targetId },
        select: { jobPost: { select: { publisherScope: true, communityId: true } } },
      });
      if (!target) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
      await this.accessService.assertModerationTarget(
        access,
        target.jobPost.publisherScope,
        target.jobPost.communityId,
      );
      return;
    }
    throw new BizException(10003, '该举报仅平台管理员可处理', HttpStatus.FORBIDDEN);
  }


  // 商家审核通过：置 APPROVED + 加 MERCHANT 角色 + 留痕 ModerationRecord
  async approveMerchant(id: string, reviewerId: string, reason?: string) {
    const m = await this.prisma.merchant.findUnique({ where: { id } });
    if (!m) throw new BizException(60002, '商家不存在', HttpStatus.NOT_FOUND);
    await this.prisma.merchant.update({ where: { id }, data: { status: MerchantStatus.APPROVED } });
    await this.prisma.userRole.upsert({
      where: { userId_role: { userId: m.userId, role: Role.MERCHANT } },
      update: {},
      create: { userId: m.userId, role: Role.MERCHANT },
    });
    await this.prisma.moderationRecord.create({
      data: { targetType: 'merchant', targetId: id, reason: reason ?? '审核通过', status: 'APPROVED', reviewerId },
    });
    return { id, status: MerchantStatus.APPROVED };
  }

  // 商家审核拒绝：置 REJECTED + 移除 MERCHANT 角色 + 留痕
  async rejectMerchant(id: string, reviewerId: string, reason?: string) {
    const m = await this.prisma.merchant.findUnique({ where: { id } });
    if (!m) throw new BizException(60002, '商家不存在', HttpStatus.NOT_FOUND);
    await this.prisma.merchant.update({ where: { id }, data: { status: MerchantStatus.REJECTED } });
    await this.prisma.userRole.deleteMany({
      where: { userId: m.userId, role: Role.MERCHANT },
    });
    await this.prisma.moderationRecord.create({
      data: { targetType: 'merchant', targetId: id, reason: reason ?? '审核拒绝', status: 'REJECTED', reviewerId },
    });
    return { id, status: MerchantStatus.REJECTED };
  }

  // 帖子下架（表白墙）+ 留痕
  async takedownPost(id: string, reviewerId: string, reason?: string, access?: AdminAccessContext) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    const authority = access
      ? await this.accessService.assertModerationTarget(access, post.publisherScope, post.communityId)
      : ModerationAuthority.PLATFORM;
    this.assertNoAuthorityDowngrade(post.moderationAuthority, authority);
    if (post.status === PostStatus.REJECTED) {
      throw new BizException(40004, '内容已下架，请刷新后重试', HttpStatus.CONFLICT);
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.post.updateMany({
        where: { id, status: post.status, moderationVersion: post.moderationVersion },
        data: { status: PostStatus.REJECTED, moderationAuthority: authority, moderationVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
      await tx.moderationRecord.create({
        data: { targetType: 'post', targetId: id, reason: reason ?? '管理员下架', status: 'REJECTED', reviewerId },
      });
    });
    this.confession.invalidateFeedCache();
    if (post.authorId !== reviewerId) {
      void this.notification
        .create({
          userId: post.authorId,
          type: NotificationType.POST_TAKEDOWN,
          title: '表白墙 · 内容下架',
          content: reason ? `你的帖子已被管理员下架：${reason}` : '你的帖子已被管理员下架',
          targetType: 'post',
          targetId: id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify takedown failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    return { id, status: PostStatus.REJECTED };
  }

  // 匿名帖下架（树洞）+ 留痕
  async takedownAnonPost(id: string, reviewerId: string, reason?: string, access?: AdminAccessContext) {
    const post = await this.prisma.anonymousPost.findUnique({ where: { id } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    const authority = access
      ? await this.accessService.assertModerationTarget(access, post.publisherScope, post.communityId)
      : ModerationAuthority.PLATFORM;
    this.assertNoAuthorityDowngrade(post.moderationAuthority, authority);
    if (post.status === PostStatus.REJECTED) {
      throw new BizException(40004, '内容已下架，请刷新后重试', HttpStatus.CONFLICT);
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.anonymousPost.updateMany({
        where: { id, status: post.status, moderationVersion: post.moderationVersion },
        data: { status: PostStatus.REJECTED, moderationAuthority: authority, moderationVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
      await tx.moderationRecord.create({
        data: { targetType: 'anon-post', targetId: id, reason: reason ?? '管理员下架', status: 'REJECTED', reviewerId },
      });
    });
    return { id, status: PostStatus.REJECTED };
  }

  // R4 岗位下架（兼职）+ 留痕 + 通知商家。管理员主动处置闭环（不依赖举报）。
  async takedownJobPost(id: string, reviewerId: string, reason?: string, access?: AdminAccessContext) {
    const post = await this.prisma.jobPost.findUnique({
      where: { id },
      include: { merchant: { select: { userId: true } } },
    });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    const authority = access
      ? await this.accessService.assertModerationTarget(access, post.publisherScope, post.communityId)
      : ModerationAuthority.PLATFORM;
    this.assertNoAuthorityDowngrade(post.moderationAuthority, authority);
    if (post.status !== JobPostStatus.PUBLISHED) {
      throw new BizException(40004, '仅已发布岗位可由管理员下架', HttpStatus.CONFLICT);
    }
    const blockedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const changed = await this.tutorJobPolicy.takeDownJobPostWithGuard(
        tx,
        id,
        blockedAt,
        { requireTutorBinding: false, publishedOnly: true },
      );
      if (!changed) throw new BizException(40004, '岗位已变更，请刷新后重试', HttpStatus.CONFLICT);
      const result = await tx.jobPost.updateMany({
        where: { id, status: JobPostStatus.TAKEN_DOWN, moderationVersion: post.moderationVersion },
        data: { moderationAuthority: authority, moderationVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new BizException(40004, '岗位已变更，请刷新后重试', HttpStatus.CONFLICT);
      await tx.moderationRecord.create({
        data: { targetType: 'job_post', targetId: id, reason: reason ?? '管理员下架', status: 'REJECTED', reviewerId },
      });
    });
    if (post.merchant) {
      void this.notification
        .create({
          userId: post.merchant.userId,
          type: NotificationType.POST_TAKEDOWN,
          title: '兼职 · 岗位下架',
          content: reason ? `你的岗位因违规被平台下架：${reason}` : '你的岗位因违规被平台下架',
          targetType: 'job_post',
          targetId: id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify job takedown failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    return { id, status: JobPostStatus.TAKEN_DOWN };
  }

  async restorePost(id: string, expectedVersion: number, reviewerId: string, access: AdminAccessContext) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    await this.accessService.assertModerationTarget(access, post.publisherScope, post.communityId);
    this.assertRestoreAuthority(post.moderationAuthority, access);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.post.updateMany({
        where: {
          id,
          status: PostStatus.REJECTED,
          moderationAuthority: post.moderationAuthority,
          moderationVersion: expectedVersion,
        },
        data: { status: PostStatus.APPROVED, moderationAuthority: null, moderationVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
      await tx.moderationRecord.create({
        data: { targetType: 'post', targetId: id, reason: '管理员恢复内容', status: 'APPROVED', reviewerId },
      });
    });
    this.confession.invalidateFeedCache();
    return { id, status: PostStatus.APPROVED, moderationVersion: expectedVersion + 1 };
  }

  async restoreAnonPost(id: string, expectedVersion: number, reviewerId: string, access: AdminAccessContext) {
    const post = await this.prisma.anonymousPost.findUnique({ where: { id } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    await this.accessService.assertModerationTarget(access, post.publisherScope, post.communityId);
    this.assertRestoreAuthority(post.moderationAuthority, access);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.anonymousPost.updateMany({
        where: {
          id,
          status: PostStatus.REJECTED,
          moderationAuthority: post.moderationAuthority,
          moderationVersion: expectedVersion,
        },
        data: { status: PostStatus.APPROVED, moderationAuthority: null, moderationVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
      await tx.moderationRecord.create({
        data: { targetType: 'anon-post', targetId: id, reason: '管理员恢复内容', status: 'APPROVED', reviewerId },
      });
    });
    return { id, status: PostStatus.APPROVED, moderationVersion: expectedVersion + 1 };
  }

  async restoreJobPost(id: string, expectedVersion: number, reviewerId: string, access: AdminAccessContext) {
    const post = await this.prisma.jobPost.findUnique({ where: { id } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    await this.accessService.assertModerationTarget(access, post.publisherScope, post.communityId);
    this.assertRestoreAuthority(post.moderationAuthority, access);
    await this.prisma.$transaction(async (tx) => {
      const [lockedPost] = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id"
         FROM "job_posts"
         WHERE "id" = $1
         FOR UPDATE`,
        id,
      );
      if (!lockedPost) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
      const [latestPublishOrder] = await tx.$queryRawUnsafe<Array<{ id: string; status: PayStatus }>>(
        `SELECT "id", "status"
         FROM "payment_orders"
         WHERE "job_post_id" = $1 AND "scene" = 'JOB_PUBLISH'
         ORDER BY "created_at" DESC, "id" DESC
         LIMIT 1
         FOR UPDATE`,
        id,
      );
      if (latestPublishOrder?.status !== PayStatus.PAID) {
        throw new BizException(40004, '岗位没有有效发布订单，请由商家重新发布并支付', HttpStatus.CONFLICT);
      }
      const result = await tx.jobPost.updateMany({
        where: {
          id,
          status: JobPostStatus.TAKEN_DOWN,
          moderationAuthority: post.moderationAuthority,
          moderationVersion: expectedVersion,
        },
        data: {
          status: JobPostStatus.PUBLISHED,
          takenDownAt: null,
          moderationAuthority: null,
          moderationVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
      await tx.moderationRecord.create({
        data: { targetType: 'job_post', targetId: id, reason: '管理员恢复岗位', status: 'APPROVED', reviewerId },
      });
    });
    return { id, status: JobPostStatus.PUBLISHED, moderationVersion: expectedVersion + 1 };
  }

  private assertNoAuthorityDowngrade(
    existing: ModerationAuthority | null,
    requested: ModerationAuthority,
  ): void {
    if (existing === ModerationAuthority.PLATFORM && requested === ModerationAuthority.COMMUNITY) {
      throw new BizException(10003, '平台处置不可被圈子管理员覆盖', HttpStatus.FORBIDDEN);
    }
  }

  private assertRestoreAuthority(
    authority: ModerationAuthority | null,
    access: AdminAccessContext,
  ): asserts authority is ModerationAuthority {
    if (!authority) {
      throw new BizException(40004, '该状态不是管理员下架，请按原发布流程处理', HttpStatus.CONFLICT);
    }
    if (authority === ModerationAuthority.PLATFORM && !access.isPlatform) {
      throw new BizException(10003, '平台下架内容仅平台管理员可恢复', HttpStatus.FORBIDDEN);
    }
  }

  // P2-05 帖子置顶/取消置顶 + 留痕
  async pinPost(id: string, reviewerId: string, pinned: boolean, reason?: string, access?: AdminAccessContext) {
    const p = await this.prisma.post.findUnique({ where: { id } });
    if (!p) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    if (access) await this.accessService.assertModerationTarget(access, p.publisherScope, p.communityId);
    await this.prisma.post.update({ where: { id }, data: { pinned } });
    this.confession.invalidateFeedCache();
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'post',
        targetId: id,
        reason: reason ?? (pinned ? '管理员置顶' : '取消置顶'),
        status: 'APPROVED',
        reviewerId,
      },
    });
    return { id, pinned };
  }

  // P2-05 帖子加精/取消加精 + 留痕
  async featurePost(id: string, reviewerId: string, featured: boolean, reason?: string, access?: AdminAccessContext) {
    const p = await this.prisma.post.findUnique({ where: { id } });
    if (!p) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    if (access) await this.accessService.assertModerationTarget(access, p.publisherScope, p.communityId);
    await this.prisma.post.update({ where: { id }, data: { featured } });
    this.confession.invalidateFeedCache();
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'post',
        targetId: id,
        reason: reason ?? (featured ? '管理员加精' : '取消加精'),
        status: 'APPROVED',
        reviewerId,
      },
    });
    return { id, featured };
  }

  // P2-15 兼职精品 toggle（admin）
  async featureJob(id: string, reviewerId: string, featured: boolean, access?: AdminAccessContext) {
    const p = await this.prisma.jobPost.findUnique({ where: { id } });
    if (!p) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (access) await this.accessService.assertModerationTarget(access, p.publisherScope, p.communityId);
    // 仅已发布岗位可设/取消精品：未发布/已下架/已过期不在精品池（featured 列表查 status=PUBLISHED），设了也不展示
    if (p.status !== JobPostStatus.PUBLISHED) {
      throw new BizException(50002, '仅已发布岗位可设精品', HttpStatus.CONFLICT);
    }
    await this.prisma.jobPost.update({
      where: { id },
      data: { featured, featuredAt: featured ? new Date() : null },
    });
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'job_post',
        targetId: id,
        reason: featured ? '设为精品岗位' : '取消精品',
        status: 'APPROVED',
        reviewerId,
      },
    });
    return { id, featured };
  }

  // ===== P2-20 工单管理（admin）=====
  async listTickets(status?: string) {
    const where: Prisma.SupportTicketWhereInput = {};
    if (status === 'OPEN' || status === 'IN_PROGRESS' || status === 'CLOSED') where.status = status;
    const list = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const userIds = [...new Set(list.map((t) => t.userId))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nickname: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.nickname]));
    return list.map((t) => ({
      id: t.id,
      userId: t.userId,
      userNickname: userMap.get(t.userId) ?? '',
      role: t.role,
      title: t.title,
      content: t.content,
      status: t.status,
      reply: t.reply,
      repliedAt: t.repliedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async replyTicket(id: string, reviewerId: string, reply: string, close: boolean) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new BizException(20003, '工单不存在', HttpStatus.NOT_FOUND);
    const r = reply?.trim();
    if (!r) throw new BizException(20003, '回复内容不能为空', HttpStatus.BAD_REQUEST);
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        reply: r,
        repliedBy: reviewerId,
        repliedAt: new Date(),
        status: close ? 'CLOSED' : 'IN_PROGRESS',
      },
    });
    // B 工单回复通知用户（对比封禁/下架都有通知，工单回复原先静默）
    void this.notification
      .create({
        userId: t.userId,
        type: NotificationType.TICKET_REPLY,
        title: close ? '工单 · 已回复并关闭' : '工单 · 已回复',
        content: r,
        targetType: 'support_ticket',
        targetId: id,
      })
      .catch((e: unknown) =>
        this.logger.warn(`notify ticket reply failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    return updated;
  }

  // D 工单 reopen：CLOSED 重开为 IN_PROGRESS 并清回复（重新回复）
  async reopenTicket(id: string, reviewerId: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new BizException(20003, '工单不存在', HttpStatus.NOT_FOUND);
    if (t.status !== 'CLOSED') throw new BizException(40004, '只能重开已关闭工单', HttpStatus.CONFLICT);
    void reviewerId;
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: 'IN_PROGRESS', reply: null, repliedBy: null, repliedAt: null },
    });
    return { id, status: 'IN_PROGRESS' as const };
  }

  // ===== 兼职岗位列表 =====
  async listJobPostsAdmin(
    page: number,
    pageSize: number,
    scope: ModerationScope | undefined,
    communityId: string | undefined,
    access: AdminAccessContext,
  ) {
    const context = await this.resolveContentContext(access, scope, communityId);
    const where: Prisma.JobPostWhereInput = { publisherScope: context.scope as PublicationScope };
    if (context.communityId) where.communityId = context.communityId;
    const [posts, total] = await Promise.all([
      this.prisma.jobPost.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { merchant: { select: { shopName: true } } },
      }),
      this.prisma.jobPost.count({ where }),
    ]);
    return {
      list: posts.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        communityId: p.communityId,
        publisherScope: p.publisherScope,
        moderationAuthority: p.moderationAuthority,
        moderationVersion: p.moderationVersion,
        urgent: p.urgent,
        featured: p.featured,
        merchantShopName: p.merchant?.shopName ?? '',
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ===== 用户列表 =====
  async listUsers(
    keyword: string | undefined,
    limit: number,
    scope: ModerationScope | undefined,
    communityId: string | undefined,
    access: AdminAccessContext,
  ) {
    const resolvedScope = await this.accessService.assertModerationContext(access, scope, communityId, true);
    const where: Prisma.UserWhereInput = {};
    if (resolvedScope === 'COMMUNITY') {
      if (communityId) {
        where.communityMembers = { some: { communityId } };
      } else if (!access.allCommunities) {
        where.communityMembers = { some: { communityId: { in: access.communityIds } } };
      }
    }
    if (keyword?.trim()) {
      where.OR = [
        { nickname: { contains: keyword.trim(), mode: 'insensitive' } },
        { id: keyword.trim() },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
      select: { id: true, nickname: true, avatarUrl: true, banAuthority: true, deletedAt: true, mutedUntil: true, createdAt: true },
    });
    const communityBans = resolvedScope === 'COMMUNITY' && users.length
      ? await this.prisma.communityUserBan.findMany({
          where: {
            userId: { in: users.map((user) => user.id) },
            active: true,
            ...(communityId ? { communityId } : (!access.allCommunities ? { communityId: { in: access.communityIds } } : {})),
          },
          select: { userId: true, authority: true },
        })
      : [];
    const banByUser = new Map(communityBans.map((ban) => [ban.userId, ban.authority]));
    return users.map((user) => ({
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      scope: resolvedScope,
      communityId: resolvedScope === 'COMMUNITY' ? (communityId ?? null) : null,
      banned: resolvedScope === 'PLATFORM' ? !!user.deletedAt : banByUser.has(user.id),
      banAuthority: resolvedScope === 'PLATFORM' ? user.banAuthority : (banByUser.get(user.id) ?? null),
      platformBanned: !!user.deletedAt,
      platformBanAuthority: user.banAuthority,
      communityBanned: banByUser.has(user.id),
      communityBanAuthority: banByUser.get(user.id) ?? null,
      mutedUntil: user.mutedUntil?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  // 批量审核商家
  async batchMerchants(ids: string[], action: 'approve' | 'reject', reviewerId: string, reason?: string) {
    let processed = 0;
    for (const id of ids) {
      try {
        if (action === 'approve') {
          await this.approveMerchant(id, reviewerId, reason);
        } else {
          await this.rejectMerchant(id, reviewerId, reason);
        }
        processed += 1;
      } catch {
        // 跳过不存在的
      }
    }
    return { processed, total: ids.length };
  }

  // 单价配置
  async getPricing() {
    const list = await this.prisma.pricingConfig.findMany({ orderBy: { duration: 'asc' } });
    return list.map((p) => ({ duration: p.duration, price: p.price.toString(), updatedAt: p.updatedAt.toISOString() }));
  }

  async updatePricing(dto: UpdatePricingDto) {
    if (dto.price <= 0) throw new BizException(60004, '单价必须大于 0');
    await this.prisma.pricingConfig.upsert({
      where: { duration: dto.duration },
      update: { price: dto.price },
      create: { duration: dto.duration, price: dto.price },
    });
    return { duration: dto.duration, price: dto.price.toString() };
  }

  // 内容推广档位（列表 + 改价）
  async getBoostPlans() {
    const list = await this.prisma.boostPlan.findMany({ orderBy: { durationHours: 'asc' } });
    return list.map((p) => ({
      code: p.code,
      name: p.name,
      durationHours: p.durationHours,
      price: p.price.toString(),
      enabled: p.enabled,
    }));
  }

  async updateBoostPlanPrice(code: string, dto: UpdateBoostPlanPriceDto) {
    const plan = await this.prisma.boostPlan.findUnique({ where: { code } });
    if (!plan) throw new BizException(50006, '推广档位不存在', HttpStatus.NOT_FOUND);
    if (dto.price < 0) throw new BizException(60004, '推广价不能为负');
    await this.prisma.boostPlan.update({ where: { code }, data: { price: dto.price } });
    return { code, price: dto.price.toString() };
  }

  async banUser(
    id: string,
    scope: ModerationScope | undefined,
    communityId: string | undefined,
    reason: string | undefined,
    reviewerId: string,
    access: AdminAccessContext,
  ) {
    const resolvedScope = await this.accessService.assertModerationContext(
      access,
      scope,
      communityId,
      (scope ?? 'COMMUNITY') === 'COMMUNITY',
    );
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, openid: true } });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    const targetAdmin = await this.prisma.adminUser.findUnique({
      where: { openid: user.openid },
      include: { adminType: { select: { isPlatform: true } } },
    });
    if (resolvedScope === 'COMMUNITY' && !access.isPlatform && targetAdmin?.adminType.isPlatform) {
      throw new BizException(10003, '圈子管理员不能封禁平台管理员', HttpStatus.FORBIDDEN);
    }
    if (resolvedScope === 'PLATFORM') {
      await this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), banAuthority: ModerationAuthority.PLATFORM },
      });
      void this.notification
        .create({
          userId: id,
          type: NotificationType.USER_BANNED,
          title: '账号 · 已封禁',
          content: reason?.trim() ? `你的账号因违反社区规范被封禁：${reason.trim()}` : '你的账号因违反社区规范被封禁；如需申诉请联系客服',
          targetType: 'user',
          targetId: id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify ban failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    } else {
      const requestedAuthority = access.isPlatform
        ? ModerationAuthority.PLATFORM
        : ModerationAuthority.COMMUNITY;
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT "id"
           FROM "users"
           WHERE "id" = $1
           FOR UPDATE`,
          id,
        );
        const existing = await tx.communityUserBan.findUnique({
          where: { communityId_userId: { communityId: communityId!, userId: id } },
        });
        if (!existing) {
          await tx.communityUserBan.create({
            data: {
              communityId: communityId!,
              userId: id,
              authority: requestedAuthority,
              reason: reason?.trim() || null,
              bannedBy: reviewerId,
            },
          });
          return;
        }
        const result = await tx.communityUserBan.updateMany({
          where: {
            id: existing.id,
            ...(requestedAuthority === ModerationAuthority.COMMUNITY
              ? { OR: [{ active: false }, { authority: ModerationAuthority.COMMUNITY }] }
              : {}),
          },
          data: {
            active: true,
            authority: requestedAuthority,
            reason: reason?.trim() || null,
            bannedBy: reviewerId,
            bannedAt: new Date(),
            liftedBy: null,
            liftedAt: null,
          },
        });
        if (result.count !== 1) {
          throw new BizException(10003, '平台封禁不可被圈子管理员覆盖', HttpStatus.FORBIDDEN);
        }
      });
    }
    return { id, scope: resolvedScope, communityId: resolvedScope === 'COMMUNITY' ? communityId : null, banned: true };
  }

  async unbanUser(
    id: string,
    scope: ModerationScope | undefined,
    communityId: string | undefined,
    reviewerId: string,
    access: AdminAccessContext,
  ) {
    const resolvedScope = await this.accessService.assertModerationContext(
      access,
      scope,
      communityId,
      (scope ?? 'COMMUNITY') === 'COMMUNITY',
    );
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    if (resolvedScope === 'PLATFORM') {
      await this.prisma.user.update({ where: { id }, data: { deletedAt: null, banAuthority: null } });
    } else {
      const ban = await this.prisma.communityUserBan.findUnique({
        where: { communityId_userId: { communityId: communityId!, userId: id } },
      });
      if (ban?.authority === ModerationAuthority.PLATFORM && !access.isPlatform) {
        throw new BizException(10003, '圈子管理员不能解除平台封禁', HttpStatus.FORBIDDEN);
      }
      if (ban?.active) {
        const result = await this.prisma.communityUserBan.updateMany({
          where: {
            id: ban.id,
            active: true,
            ...(!access.isPlatform ? { authority: ModerationAuthority.COMMUNITY } : {}),
          },
          data: { active: false, liftedBy: reviewerId, liftedAt: new Date() },
        });
        if (result.count !== 1) {
          throw new BizException(
            access.isPlatform ? 40004 : 10003,
            access.isPlatform ? '封禁状态已变更，请刷新后重试' : '圈子管理员不能解除平台封禁',
            access.isPlatform ? HttpStatus.CONFLICT : HttpStatus.FORBIDDEN,
          );
        }
      }
    }
    return { id, scope: resolvedScope, communityId: resolvedScope === 'COMMUNITY' ? communityId : null, banned: false };
  }

  // P1-12 禁言（参数 days；0 或 undefined = 解除；1-365 天）
  async muteUser(id: string, days?: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    let mutedUntil: Date | null = null;
    if (days !== undefined && days !== 0) {
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw new BizException(10003, '禁言天数无效（1-365）', HttpStatus.BAD_REQUEST);
      }
      mutedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    await this.prisma.user.update({ where: { id }, data: { mutedUntil } });
    void this.notification
      .create({
        userId: id,
        type: NotificationType.USER_MUTED,
        title: '账号 · 已禁言',
        content: mutedUntil
          ? `你将被禁言至 ${mutedUntil.toISOString().slice(0, 10)}`
          : '禁言已解除',
        targetType: 'user',
        targetId: id,
      })
      .catch((e: unknown) =>
        this.logger.warn(`notify mute failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    return { id, mutedUntil };
  }

  // ===== P1-13 树洞标签库管理 =====
  async listAnonTags(category?: string) {
    return this.prisma.anonTag.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createAnonTag(dto: { name: string; category: string; sortOrder?: number; active?: boolean }) {
    const validCats = ['personality', 'interest', 'mood'];
    if (!validCats.includes(dto.category)) {
      throw new BizException(30004, '标签分类不合法（personality/interest/mood）');
    }
    const name = dto.name?.trim() ?? '';
    if (!name || name.length > 12) {
      throw new BizException(30004, '标签名长度需在 1-12 字符之间');
    }
    try {
      return await this.prisma.anonTag.create({
        data: {
          name,
          category: dto.category,
          sortOrder: dto.sortOrder ?? 0,
          active: dto.active ?? true,
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(30005, '标签已存在');
      }
      throw e;
    }
  }

  async updateAnonTag(id: string, dto: { name?: string; sortOrder?: number; active?: boolean }) {
    const existing = await this.prisma.anonTag.findUnique({ where: { id } });
    if (!existing) throw new BizException(30006, '标签不存在', HttpStatus.NOT_FOUND);
    let name = dto.name;
    if (name !== undefined) {
      name = name.trim();
      if (!name || name.length > 12) {
        throw new BizException(30004, '标签名长度需在 1-12 字符之间');
      }
    }
    try {
      return await this.prisma.anonTag.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(30005, '标签名冲突');
      }
      throw e;
    }
  }

  async deleteAnonTag(id: string) {
    const existing = await this.prisma.anonTag.findUnique({ where: { id } });
    if (!existing) throw new BizException(30006, '标签不存在', HttpStatus.NOT_FOUND);
    // 软删：置 active=false（复用 active 字段，零 schema 改动）
    // 树洞前端 listTags 只返 active=true，停用后自动从用户画像消失；
    // AnonymousProfile 中的历史标签字符串保留但不再被认为是有效标签，新发内容不能再选
    await this.prisma.anonTag.update({ where: { id }, data: { active: false } });
    return { id, deleted: true };
  }

  // ===== P2-03 活动专题管理 =====
  async listActivityTopicsAll() {
    return this.prisma.activityTopic.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }
  async createActivityTopic(dto: { title: string; coverUrl?: string; description?: string; status?: string; sortOrder?: number }) {
    return this.prisma.activityTopic.create({
      data: {
        title: dto.title,
        coverUrl: dto.coverUrl ?? null,
        description: dto.description ?? null,
        status: dto.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }
  async updateActivityTopic(id: string, dto: Partial<{ title: string; coverUrl: string | null; description: string | null; status: string; sortOrder: number }>) {
    const existing = await this.prisma.activityTopic.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, '活动专题不存在', HttpStatus.NOT_FOUND);
    const data: Prisma.ActivityTopicUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.activityTopic.update({ where: { id }, data });
  }
  async deleteActivityTopic(id: string) {
    const existing = await this.prisma.activityTopic.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, '活动专题不存在', HttpStatus.NOT_FOUND);
    await this.prisma.activityTopic.delete({ where: { id } }); // 级联删关联
    return { id, deleted: true };
  }
  // 活动专题加帖
  async addTopicPost(id: string, postId: string, sortOrder = 0) {
    const topic = await this.prisma.activityTopic.findUnique({ where: { id } });
    if (!topic) throw new BizException(20001, '活动专题不存在', HttpStatus.NOT_FOUND);
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    try {
      return await this.prisma.activityTopicPost.create({
        data: { topicId: id, postId, sortOrder },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(20002, '该帖子已在专题中', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }
  async removeTopicPost(id: string, postId: string) {
    await this.prisma.activityTopicPost.deleteMany({ where: { topicId: id, postId } });
    return { topicId: id, postId, removed: true };
  }

  // ===== P2-04 话题管理 =====
  async listTopicsAll() {
    return this.prisma.topic.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }
  async createTopic(dto: { name: string; description?: string; coverUrl?: string; status?: string; sortOrder?: number }) {
    try {
      return await this.prisma.topic.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          coverUrl: dto.coverUrl ?? null,
          status: dto.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(20002, '话题名已存在', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }
  async updateTopic(id: string, dto: Partial<{ name: string; description: string | null; coverUrl: string | null; status: string; sortOrder: number }>) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, '话题不存在', HttpStatus.NOT_FOUND);
    const data: Prisma.TopicUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl;
    if (dto.status !== undefined) data.status = dto.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    try {
      return await this.prisma.topic.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BizException(20002, '话题名已存在', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }
  async deleteTopic(id: string) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, '话题不存在', HttpStatus.NOT_FOUND);
    await this.prisma.topic.delete({ where: { id } }); // posts.topicId ON DELETE SET NULL
    return { id, deleted: true };
  }
  // 帖子归入话题（批量/单个）
  async setPostTopic(postId: string, topicId: string | null) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    if (topicId) {
      const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
      if (!topic) throw new BizException(20001, '话题不存在', HttpStatus.NOT_FOUND);
    }
    await this.prisma.post.update({ where: { id: postId }, data: { topicId } });
    this.confession.invalidateFeedCache();
    return { postId, topicId };
  }

  // ===== P2-30 管理员自助管理（AdminUser CRUD）=====
  // 自检：当前 admin 的 openid === 被删 AdminUser.openid 即"删自己" → 40004
  // 删除时同步删 UserRole.ADMIN，避免"AdminUser 没了但 UserRole.ADMIN 还在"的不一致

  // 列管理员（关联查 User 拿头像昵称；keyword 对展示昵称/username/openid 统一模糊筛选；
  // isSelf 给前端 disable「删除自己」按钮用）
  async listAdmins(keyword?: string, currentOpenid?: string) {
    const kw = keyword?.trim();
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        adminType: {
          select: {
            id: true,
            name: true,
            code: true,
            active: true,
            isPlatform: true,
          },
        },
        communityScopes: {
          include: { community: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    // 风险3 相关：admin openid 可能为 null（未绑微信的占位 admin），反查时统一 filter
    const openids = admins.map((a) => a.openid).filter((v): v is string => !!v);
    const users = openids.length
      ? await this.prisma.user.findMany({
          where: { openid: { in: openids } },
          select: { id: true, nickname: true, avatarUrl: true, openid: true },
        })
      : [];
    const userByOpenid = new Map(users.map((u) => [u.openid, u]));
    const rows = admins.map((a) => {
      const u = a.openid ? userByOpenid.get(a.openid) : undefined;
      return {
        id: a.id,
        username: a.username,
        openid: a.openid,
        createdAt: a.createdAt.toISOString(),
        adminType: a.adminType,
        allCommunities: a.adminType.isPlatform || a.allCommunities,
        communities: a.communityScopes.map((scope) => scope.community),
        linkedUser: u ? { id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl } : null,
        // 前端"自己"判断用：openid 字符串比对。后端权威，前端不再需单独查
        isSelf: !!currentOpenid && !!a.openid && a.openid === currentOpenid,
      };
    });
    if (!kw) return rows;

    const normalizedKw = kw.toLocaleLowerCase();
    return rows.filter((a) =>
      a.username.toLocaleLowerCase().includes(normalizedKw)
      || (a.openid ?? '').toLocaleLowerCase().includes(normalizedKw)
      || (a.linkedUser?.nickname ?? '').toLocaleLowerCase().includes(normalizedKw),
    );
  }

  // 添加管理员：类型和圈子范围均显式指定，禁止旧客户端默认创建平台管理员。
  async createAdmin(dto: CreateAdminDto, access: AdminAccessContext) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new BizException(40001, '用户不存在', HttpStatus.NOT_FOUND);
    if (!user.openid) throw new BizException(40002, '该用户未绑定微信，无法设为管理员', HttpStatus.BAD_REQUEST);
    const existing = await this.prisma.adminUser.findUnique({ where: { openid: user.openid } });
    if (existing) {
      throw new BizException(40013, '该用户已是管理员，请使用编辑功能调整权限', HttpStatus.CONFLICT);
    }
    const assignment = await this.validateAdminAssignment(
      dto.adminTypeId,
      dto.allCommunities,
      dto.communityIds,
    );
    const admin = await this.prisma.$transaction(async (tx) => {
        const row = await tx.adminUser.create({
          data: {
            openid: user.openid,
            username: `admin_${user.id}`,
            adminTypeId: assignment.adminType.id,
            allCommunities: assignment.allCommunities,
          },
        });
        if (!assignment.allCommunities && assignment.communityIds.length) {
          await tx.adminCommunityScope.createMany({
            data: assignment.communityIds.map((communityId) => ({
              adminUserId: row.id,
              communityId,
            })),
          });
        }
        await tx.userRole.upsert({
          where: { userId_role: { userId: user.id, role: Role.ADMIN } },
          create: { userId: user.id, role: Role.ADMIN },
          update: {},
        });
        return row;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const targets = Array.isArray(error.meta?.target)
            ? error.meta.target.map(String)
            : [];
          if (targets.includes('openid')) {
            throw new BizException(40013, '该用户已是管理员，请使用编辑功能调整权限', HttpStatus.CONFLICT);
          }
          throw new BizException(40014, '管理员账号标识冲突，请重试', HttpStatus.CONFLICT);
        }
        throw error;
      });
    await this.accessService.audit(access, 'admin.create', 'admin_user', admin.id, {
      adminTypeId: assignment.adminType.id,
      allCommunities: assignment.allCommunities,
      communityIds: assignment.communityIds,
    });
    this.logger.log(`createAdmin: user=${user.id} openid=${user.openid}`);
    return {
      id: admin.id,
      username: admin.username,
      openid: admin.openid,
      createdAt: admin.createdAt.toISOString(),
      adminType: assignment.adminType,
      allCommunities: assignment.allCommunities,
      communities: assignment.communities,
      linkedUser: { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl },
    };
  }

  async updateAdmin(id: string, dto: UpdateAdminAssignmentDto, access: AdminAccessContext) {
    const existing = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { adminType: { select: { isPlatform: true } } },
    });
    if (!existing) throw new BizException(40003, '管理员不存在', HttpStatus.NOT_FOUND);
    const assignment = await this.validateAdminAssignment(
      dto.adminTypeId,
      dto.allCommunities,
      dto.communityIds,
    );
    if (existing.adminType.isPlatform && !assignment.adminType.isPlatform && id === access.adminId) {
      throw new BizException(40004, '不能降低自己的平台管理员权限', HttpStatus.FORBIDDEN);
    }
    await this.prisma.$transaction(async (tx) => {
      if (existing.adminType.isPlatform && !assignment.adminType.isPlatform) {
        const platformCount = await tx.adminUser.count({
          where: { adminType: { isPlatform: true, active: true, deletedAt: null } },
        });
        if (platformCount <= 1) {
          throw new BizException(40005, '至少保留 1 个平台管理员', HttpStatus.FORBIDDEN);
        }
      }
      await tx.adminUser.update({
        where: { id },
        data: {
          adminTypeId: assignment.adminType.id,
          allCommunities: assignment.allCommunities,
        },
      });
      await tx.adminCommunityScope.deleteMany({ where: { adminUserId: id } });
      if (!assignment.allCommunities && assignment.communityIds.length) {
        await tx.adminCommunityScope.createMany({
          data: assignment.communityIds.map((communityId) => ({
            adminUserId: id,
            communityId,
          })),
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.accessService.audit(access, 'admin.update', 'admin_user', id, {
      adminTypeId: assignment.adminType.id,
      allCommunities: assignment.allCommunities,
      communityIds: assignment.communityIds,
    });
    return { id, updated: true };
  }

  // 删除管理员：currentOpenid 用 JWT payload.openid（user.id 不在 AdminUser 上）
  async deleteAdmin(id: string, currentOpenid: string, access: AdminAccessContext) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { adminType: { select: { isPlatform: true } } },
    });
    if (!admin) throw new BizException(40003, '管理员不存在', HttpStatus.NOT_FOUND);
    // 风险1：openid 字符串比对，避免多查一次 User
    if (admin.openid && admin.openid === currentOpenid) {
      throw new BizException(40004, '不能删除自己', HttpStatus.FORBIDDEN);
    }
    await this.prisma.$transaction(async (tx) => {
      if (admin.adminType.isPlatform) {
        const platformCount = await tx.adminUser.count({
          where: { adminType: { isPlatform: true, active: true, deletedAt: null } },
        });
        if (platformCount <= 1) {
          throw new BizException(40005, '至少保留 1 个平台管理员', HttpStatus.FORBIDDEN);
        }
      }
      await tx.adminUser.delete({ where: { id } });
      if (admin.openid) {
        const u = await tx.user.findUnique({ where: { openid: admin.openid }, select: { id: true } });
        if (u) await tx.userRole.deleteMany({ where: { userId: u.id, role: Role.ADMIN } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.accessService.audit(access, 'admin.delete', 'admin_user', id);
    this.logger.log(`deleteAdmin: id=${id} by openid=${currentOpenid}`);
    return { id, deleted: true };
  }

  private async validateAdminAssignment(
    adminTypeId: string,
    allCommunities: boolean,
    communityIds: string[],
  ) {
    const adminType = await this.prisma.adminType.findFirst({
      where: { id: adminTypeId, active: true, deletedAt: null },
      select: { id: true, name: true, code: true, active: true, isPlatform: true },
    });
    if (!adminType) {
      throw new BizException(40007, '管理员类型不存在或已停用', HttpStatus.BAD_REQUEST);
    }
    const normalizedIds = [...new Set(communityIds.filter(Boolean))];
    const effectiveAll = adminType.isPlatform || allCommunities;
    const communities = effectiveAll || !normalizedIds.length
      ? []
      : await this.prisma.community.findMany({
          where: { id: { in: normalizedIds } },
          select: { id: true, name: true },
        });
    if (!effectiveAll && !normalizedIds.length) {
      throw new BizException(40008, '请至少选择一个可管理圈子', HttpStatus.BAD_REQUEST);
    }
    if (!effectiveAll && communities.length !== normalizedIds.length) {
      throw new BizException(40008, '包含不存在的圈子', HttpStatus.BAD_REQUEST);
    }
    return {
      adminType,
      allCommunities: effectiveAll,
      communityIds: effectiveAll ? [] : normalizedIds,
      communities,
    };
  }

  listPermissions() {
    return ADMIN_PERMISSION_CATALOG.filter((item) =>
      item.code !== 'admin.manage' && item.code !== 'admin_type.manage');
  }

  async listAdminTypes() {
    const list = await this.prisma.adminType.findMany({
      where: { deletedAt: null },
      orderBy: [{ systemProtected: 'desc' }, { createdAt: 'asc' }],
      include: {
        permissions: {
          include: { permission: { select: { code: true } } },
        },
        _count: { select: { admins: true } },
      },
    });
    return list.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      description: item.description,
      active: item.active,
      isPlatform: item.isPlatform,
      systemProtected: item.systemProtected,
      permissionCodes: item.isPlatform
        ? ADMIN_PERMISSION_CATALOG.map((permission) => permission.code)
        : item.permissions.map((permission) => permission.permission.code),
      adminCount: item._count.admins,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async createAdminType(dto: CreateAdminTypeDto, access: AdminAccessContext) {
    const duplicate = await this.prisma.adminType.findFirst({
      where: {
        deletedAt: null,
        OR: [{ name: dto.name.trim() }, { code: dto.code.trim() }],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BizException(40014, '管理员类型名称或编码已存在', HttpStatus.CONFLICT);
    }
    const permissionCodes = normalizeAdminPermissionCodes(dto.permissionCodes);
    const permissionIds = await this.resolvePermissionIds(permissionCodes);
    const created = await this.prisma.adminType.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim(),
        description: dto.description?.trim() || null,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });
    await this.accessService.audit(access, 'admin_type.create', 'admin_type', created.id, {
      permissionCodes,
    });
    return created;
  }

  async updateAdminType(id: string, dto: UpdateAdminTypeDto, access: AdminAccessContext) {
    const existing = await this.prisma.adminType.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new BizException(40009, '管理员类型不存在', HttpStatus.NOT_FOUND);
    if (existing.isPlatform && (dto.active === false || dto.permissionCodes !== undefined)) {
      throw new BizException(40010, '平台管理员类型不能停用或修改权限', HttpStatus.FORBIDDEN);
    }
    if (dto.active === false && existing.systemProtected) {
      throw new BizException(40010, '系统预设管理员类型不能停用', HttpStatus.FORBIDDEN);
    }
    if (dto.name !== undefined) {
      const duplicate = await this.prisma.adminType.findFirst({
        where: {
          id: { not: id },
          deletedAt: null,
          name: dto.name.trim(),
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new BizException(40014, '管理员类型名称已存在', HttpStatus.CONFLICT);
      }
    }
    const permissionCodes = dto.permissionCodes === undefined
      ? null
      : normalizeAdminPermissionCodes(dto.permissionCodes);
    const permissionIds = permissionCodes === null
      ? null
      : await this.resolvePermissionIds(permissionCodes);
    await this.prisma.$transaction(async (tx) => {
      await tx.adminType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      });
      if (permissionIds) {
        await tx.adminTypePermission.deleteMany({ where: { adminTypeId: id } });
        if (permissionIds.length) {
          await tx.adminTypePermission.createMany({
            data: permissionIds.map((permissionId) => ({ adminTypeId: id, permissionId })),
          });
        }
      }
    });
    await this.accessService.audit(access, 'admin_type.update', 'admin_type', id, {
      ...dto,
      ...(permissionCodes === null ? {} : { permissionCodes }),
    });
    return { id, updated: true };
  }

  async deleteAdminType(id: string, access: AdminAccessContext) {
    const existing = await this.prisma.adminType.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { admins: true } } },
    });
    if (!existing) throw new BizException(40009, '管理员类型不存在', HttpStatus.NOT_FOUND);
    if (existing.systemProtected || existing.isPlatform) {
      throw new BizException(40010, '系统预设管理员类型不能删除', HttpStatus.FORBIDDEN);
    }
    if (existing._count.admins > 0) {
      throw new BizException(40011, '该类型仍有关联管理员，不能删除', HttpStatus.CONFLICT);
    }
    await this.prisma.adminType.delete({ where: { id } });
    await this.accessService.audit(access, 'admin_type.delete', 'admin_type', id);
    return { id, deleted: true };
  }

  private async resolvePermissionIds(permissionCodes: string[]) {
    const normalizedCodes = normalizeAdminPermissionCodes(permissionCodes);
    if (normalizedCodes.includes('admin.manage') || normalizedCodes.includes('admin_type.manage')) {
      throw new BizException(40012, '管理员账号与类型管理仅属于平台管理员', HttpStatus.BAD_REQUEST);
    }
    const permissions = await this.prisma.adminPermission.findMany({
      where: { code: { in: normalizedCodes } },
      select: { id: true, code: true },
    });
    if (permissions.length !== normalizedCodes.length) {
      throw new BizException(40012, '包含不存在的权限项', HttpStatus.BAD_REQUEST);
    }
    return permissions.map((permission) => permission.id);
  }

  async listAuditLogs(access: AdminAccessContext, limit = 50) {
    return this.prisma.adminAuditLog.findMany({
      where: access.isPlatform ? {} : { actorAdminId: access.adminId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
      include: { actor: { select: { username: true } } },
    });
  }

  // 搜索候选 User（用于添加弹窗）：keyword 必填（DTO MinLength(1) + service 双保险）
  // 强制最小长度避免无关键词返回全量 50 条；排除已是 admin + 排除封禁
  async searchCandidateUsers(keyword?: string) {
    const kw = keyword?.trim();
    if (!kw) {
      throw new BizException(40006, '请输入关键词搜索候选用户', HttpStatus.BAD_REQUEST);
    }
    // 风险3：admin.openid 可能为 null，in: [null] 在 PG 等价于 IS NULL，会污染结果；显式 filter
    const existingOpenids = (await this.prisma.adminUser.findMany({ select: { openid: true } }))
      .map((a) => a.openid)
      .filter((v): v is string => !!v);
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        nickname: { contains: kw, mode: 'insensitive' },
        ...(existingOpenids.length ? { NOT: { openid: { in: existingOpenids } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, nickname: true, avatarUrl: true },
    });
    return users;
  }

  // ===== Banner 广告位管理 =====
  async listBanners(communityId: string | undefined, keyword: string | undefined, access: AdminAccessContext) {
    if (communityId) await this.accessService.assertCommunity(access, communityId);
    const scopedCommunityId = this.accessService.communityIdWhere(access);
    return this.prisma.banner.findMany({
      where: {
        ...(communityId ? { communityId } : scopedCommunityId ? { communityId: scopedCommunityId } : {}),
        ...(keyword ? { title: { contains: keyword, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ communityId: 'asc' }, { sortOrder: 'asc' }],
      include: { community: { select: { name: true } } },
    });
  }
  async createBanner(dto: {
    title: string;
    imageUrl: string;
    linkUrl?: string | null;
    communityId: string;
    sortOrder?: number;
  }, access: AdminAccessContext) {
    if (!dto.communityId) {
      throw new BizException(40013, '广告位必须选择所属圈子', HttpStatus.BAD_REQUEST);
    }
    await this.accessService.assertCommunity(access, dto.communityId);
    const community = await this.prisma.community.findUnique({ where: { id: dto.communityId }, select: { id: true } });
    if (!community) throw new BizException(80010, '圈子不存在', HttpStatus.NOT_FOUND);
    const created = await this.prisma.banner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl ?? null,
        communityId: dto.communityId,
        sortOrder: dto.sortOrder ?? 0,
        status: BannerStatus.ENABLED,
      },
    });
    await this.accessService.audit(access, 'banner.create', 'banner', created.id, { communityId: created.communityId });
    return created;
  }
  async updateBanner(
    id: string,
    dto: Partial<{
      title: string;
      imageUrl: string;
      linkUrl: string | null;
      communityId: string;
      sortOrder: number;
      status: string;
    }>,
    access: AdminAccessContext,
  ) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, 'Banner 不存在', HttpStatus.NOT_FOUND);
    await this.accessService.assertCommunity(access, existing.communityId);
    const data: Prisma.BannerUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl;
    if (dto.communityId !== undefined) {
      if (!dto.communityId) {
        throw new BizException(40013, '广告位必须选择所属圈子', HttpStatus.BAD_REQUEST);
      }
      await this.accessService.assertCommunity(access, dto.communityId);
      data.community = { connect: { id: dto.communityId } };
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status === 'DISABLED' ? BannerStatus.DISABLED : BannerStatus.ENABLED;
    const updated = await this.prisma.banner.update({ where: { id }, data });
    await this.accessService.audit(access, 'banner.update', 'banner', id, { communityId: updated.communityId });
    return updated;
  }
  async deleteBanner(id: string, access: AdminAccessContext) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, 'Banner 不存在', HttpStatus.NOT_FOUND);
    await this.accessService.assertCommunity(access, existing.communityId);
    await this.prisma.banner.delete({ where: { id } });
    await this.accessService.audit(access, 'banner.delete', 'banner', id, { communityId: existing.communityId });
    return { id, deleted: true };
  }
  async toggleBanner(id: string, enabled: boolean, access: AdminAccessContext) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new BizException(20001, 'Banner 不存在', HttpStatus.NOT_FOUND);
    await this.accessService.assertCommunity(access, existing.communityId);
    const updated = await this.prisma.banner.update({
      where: { id },
      data: { status: enabled ? BannerStatus.ENABLED : BannerStatus.DISABLED },
    });
    await this.accessService.audit(access, 'banner.toggle', 'banner', id, { enabled, communityId: existing.communityId });
    return updated;
  }

  // ===== 圈子（Community）管理 =====
  async listCommunities(status: string | undefined, keyword: string | undefined, access: AdminAccessContext) {
    // P2-26 扩 status 过滤支持 PENDING
    const statusEnum =
      status === 'PENDING'
        ? CommunityStatus.PENDING
        : status === 'DISABLED'
        ? CommunityStatus.DISABLED
        : status === 'ACTIVE'
        ? CommunityStatus.ACTIVE
        : null;
    return this.prisma.community.findMany({
      where: {
        ...this.accessService.communityWhere(access),
        ...(statusEnum ? { status: statusEnum } : {}),
        ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async updateCommunity(id: string, dto: UpdateCommunityDto, access: AdminAccessContext) {
    await this.accessService.assertCommunity(access, id);
    const existing = await this.prisma.community.findUnique({ where: { id } });
    if (!existing) throw new BizException(80010, '圈子不存在', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.logo !== undefined ? { logo: dto.logo.trim() || null } : {}),
        ...(dto.backgroundImage !== undefined ? { backgroundImage: dto.backgroundImage.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
      },
    });
    await this.accessService.audit(access, 'community.update', 'community', id);
    return updated;
  }

  async disableCommunity(id: string, access: AdminAccessContext) {
    await this.accessService.assertCommunity(access, id);
    const existing = await this.prisma.community.findUnique({ where: { id } });
    if (!existing) throw new BizException(80010, '圈子不存在', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.community.update({ where: { id }, data: { status: CommunityStatus.DISABLED } });
    this.confession.invalidateFeedCache(); // 圈子禁用 → 清表白墙 feed 缓存（communityId 作用域内容即时隐藏）
    await this.accessService.audit(access, 'community.disable', 'community', id);
    return updated;
  }
  async enableCommunity(id: string, access: AdminAccessContext) {
    await this.accessService.assertCommunity(access, id);
    const existing = await this.prisma.community.findUnique({ where: { id } });
    if (!existing) throw new BizException(80010, '圈子不存在', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.community.update({ where: { id }, data: { status: CommunityStatus.ACTIVE } });
    this.confession.invalidateFeedCache();
    await this.accessService.audit(access, 'community.enable', 'community', id);
    return updated;
  }

  // ===== P2-26 圈子审核 approve / reject =====
  async approveCommunity(id: string, reviewerId: string, access: AdminAccessContext) {
    await this.accessService.assertCommunity(access, id);
    const c = await this.prisma.community.findUnique({ where: { id } });
    if (!c) throw new BizException(80010, '圈子不存在', HttpStatus.NOT_FOUND);
    if (c.status !== CommunityStatus.PENDING) {
      throw new BizException(40004, '仅待审核圈子可通过', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        status: CommunityStatus.ACTIVE,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectReason: null,
      },
    });
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'community',
        targetId: id,
        reason: '审核通过',
        status: 'APPROVED',
        reviewerId,
      },
    });
    await this.accessService.audit(access, 'community.approve', 'community', id);
    // 通知 creator（不通知自己）
    if (c.ownerId && c.ownerId !== reviewerId) {
      void this.notification
        .create({
          userId: c.ownerId,
          type: NotificationType.COMMUNITY_APPROVED,
          title: '圈子 · 审核通过',
          content: `你的圈子「${c.name}」已通过审核，现在可以使用了`,
          targetType: 'community',
          targetId: id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify community approved failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    return updated;
  }

  async rejectCommunity(id: string, reviewerId: string, reason: string, access: AdminAccessContext) {
    await this.accessService.assertCommunity(access, id);
    const c = await this.prisma.community.findUnique({ where: { id } });
    if (!c) throw new BizException(80010, '圈子不存在', HttpStatus.NOT_FOUND);
    if (c.status !== CommunityStatus.PENDING) {
      throw new BizException(40004, '仅待审核圈子可拒绝', HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        status: CommunityStatus.DISABLED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
    });
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'community',
        targetId: id,
        reason,
        status: 'REJECTED',
        reviewerId,
      },
    });
    await this.accessService.audit(access, 'community.reject', 'community', id, { reason });
    // 通知 creator（不通知自己）
    if (c.ownerId && c.ownerId !== reviewerId) {
      void this.notification
        .create({
          userId: c.ownerId,
          type: NotificationType.COMMUNITY_REJECTED,
          title: '圈子 · 审核未通过',
          content: `你的圈子「${c.name}」未通过审核：${reason}`,
          targetType: 'community',
          targetId: id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify community rejected failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    return updated;
  }

  // ===== P2-26 全局配置 KV（白名单 AppConfig）=====
  private static readonly APP_CONFIG_KEYS = [
    'community.need_review',
    ANONYMOUS_CONTENT_ENABLED_KEY,
    TUTOR_SYNC_ENABLED_KEY,
    TUTOR_SYNC_BATCH_SIZE_KEY,
  ] as const;

  async getSettings() {
    const rows = await this.prisma.appConfig.findMany({ orderBy: { key: 'asc' } });
    const rowByKey = new Map(rows.map((r) => [r.key, r]));
    return AdminService.APP_CONFIG_KEYS.map((key) => {
      const row = rowByKey.get(key);
      const defaultValue = key === TUTOR_SYNC_BATCH_SIZE_KEY
        ? TUTOR_SYNC_DEFAULT_BATCH_SIZE
        : key === TUTOR_SYNC_ENABLED_KEY
          ? TUTOR_SYNC_DEFAULT_ENABLED
          : false;
      const value = key === TUTOR_SYNC_BATCH_SIZE_KEY
        ? (parseTutorSyncBatchSize(row?.value) ?? defaultValue)
        : row?.value === true;
      return {
        key,
        value,
        updatedAt: row?.updatedAt.toISOString() ?? '',
        updatedBy: row?.updatedBy ?? null,
      };
    });
  }

  async updateSetting(key: string, value: unknown, updatedBy: string) {
    if (!(AdminService.APP_CONFIG_KEYS as readonly string[]).includes(key)) {
      throw new BizException(40004, `不支持的配置项: ${key}`, HttpStatus.BAD_REQUEST);
    }
    let normalizedValue: boolean | number;
    if (
      key === 'community.need_review'
      || key === ANONYMOUS_CONTENT_ENABLED_KEY
      || key === TUTOR_SYNC_ENABLED_KEY
    ) {
      if (typeof value !== 'boolean') {
        const label = key === TUTOR_SYNC_ENABLED_KEY
          ? '家教自动同步'
          : key === ANONYMOUS_CONTENT_ENABLED_KEY
            ? '匿名内容展示'
            : '建圈审核';
        throw new BizException(40003, `${label}配置必须为布尔值`, HttpStatus.BAD_REQUEST);
      }
      normalizedValue = value;
    } else {
      const batchSize = parseTutorSyncBatchSize(value);
      if (batchSize === null) {
        throw new BizException(
          40003,
          `每批同步数量必须为 ${TUTOR_SYNC_MIN_BATCH_SIZE}-${TUTOR_SYNC_MAX_BATCH_SIZE} 的整数`,
          HttpStatus.BAD_REQUEST,
        );
      }
      normalizedValue = batchSize;
    }
    return this.prisma.appConfig.upsert({
      where: { key },
      update: { value: normalizedValue, updatedBy },
      create: { key, value: normalizedValue, updatedBy },
    });
  }
}
