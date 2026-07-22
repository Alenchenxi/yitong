import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { MerchantStatus, PostStatus, Prisma, Role } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfessionService } from '../confession/confession.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import type { UpdatePricingDto } from './dto/update-pricing.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly confession: ConfessionService,
    private readonly notification: NotificationService,
  ) {}

  // 审核队列：待审核商家 + 近期帖子（含已发布，管理员可下架）
  async getQueue() {
    const [merchants, posts, anonPosts, reports] = await Promise.all([
      this.prisma.merchant.findMany({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          author: { select: { nickname: true } },
          circle: { select: { name: true } },
        },
      }),
      this.prisma.anonymousPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.moderationRecord.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      merchants: merchants.map((m) => ({
        id: m.id,
        shopName: m.shopName,
        licenseNo: m.licenseNo,
        contactPhone: m.contactPhone,
        status: m.status,
        userId: m.userId,
        userNickname: '',
        createdAt: m.createdAt.toISOString(),
      })),
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        status: p.status,
        authorNickname: p.author?.nickname ?? '',
        circleName: p.circle?.name ?? '',
        createdAt: p.createdAt.toISOString(),
      })),
      anonPosts: anonPosts.map((p) => ({
        id: p.id,
        content: p.content,
        anonId: p.anonId,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
      reports: reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
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
  async takedownPost(id: string, reviewerId: string, reason?: string) {
    const p = await this.prisma.post.findUnique({ where: { id } });
    if (!p) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    await this.prisma.post.update({ where: { id }, data: { status: PostStatus.REJECTED } });
    this.confession.invalidateFeedCache();
    await this.prisma.moderationRecord.create({
      data: { targetType: 'post', targetId: id, reason: reason ?? '管理员下架', status: 'REJECTED', reviewerId },
    });
    // P0-11 下架通知作者（注明来源表白墙；不通知自己）
    if (p.authorId !== reviewerId) {
      void this.notification
        .create({
          userId: p.authorId,
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
  async takedownAnonPost(id: string, reviewerId: string, reason?: string) {
    const p = await this.prisma.anonymousPost.findUnique({ where: { id } });
    if (!p) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    await this.prisma.anonymousPost.update({ where: { id }, data: { status: PostStatus.REJECTED } });
    await this.prisma.moderationRecord.create({
      data: { targetType: 'anon-post', targetId: id, reason: reason ?? '管理员下架', status: 'REJECTED', reviewerId },
    });
    return { id, status: PostStatus.REJECTED };
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
    await this.prisma.pricingConfig.upsert({
      where: { duration: dto.duration },
      update: { price: dto.price },
      create: { duration: dto.duration, price: dto.price },
    });
    return { duration: dto.duration, price: dto.price.toString() };
  }

  // 用户封禁（soft delete）
  async banUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    if (u.deletedAt) return { id, banned: true };
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    // P1-12 封禁通知
    void this.notification
      .create({
        userId: id,
        type: NotificationType.USER_BANNED,
        title: '账号 · 已封禁',
        content: '你的账号因违反社区规范被封禁；如需申诉请联系客服',
        targetType: 'user',
        targetId: id,
      })
      .catch((e: unknown) =>
        this.logger.warn(`notify ban failed: ${e instanceof Error ? e.message : String(e)}`),
      );
    return { id, banned: true };
  }

  // P1-12 禁言（参数 days；0 或 undefined = 解除）
  async muteUser(id: string, days?: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    const mutedUntil = days && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      : null;
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
    try {
      return await this.prisma.anonTag.create({
        data: {
          name: dto.name,
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
    try {
      return await this.prisma.anonTag.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
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
    await this.prisma.anonTag.delete({ where: { id } });
    return { id, deleted: true };
  }
}
