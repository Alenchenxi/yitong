import { HttpStatus, Injectable } from '@nestjs/common';
import { MerchantStatus, PostStatus, Role } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfessionService } from '../confession/confession.service';
import type { UpdatePricingDto } from './dto/update-pricing.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly confession: ConfessionService,
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
    return { id, banned: true };
  }
}
