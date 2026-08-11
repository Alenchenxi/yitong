import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

// 内容推广（付费置顶曝光）：档位查询 + 推广到期时间写入。
// 错误码 5xxxx 支付段（API §3）：50006 档位不存在/已下架，50007 内容不可推广。
// 红线：本 service 只写 Post/AnonymousPost 的 boostUntil，绝不写真实 uid/anonId 进树洞表。
export type BoostTargetType = 'post' | 'anon_post';

@Injectable()
export class BoostService {
  private readonly logger = new Logger(BoostService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 启用中的推广档位列表（价格转 string，避免前端精度问题）
  async listPlans() {
    const list = await this.prisma.boostPlan.findMany({
      where: { enabled: true },
      orderBy: { durationHours: 'asc' },
    });
    return list.map((p) => ({
      code: p.code,
      name: p.name,
      durationHours: p.durationHours,
      price: p.price.toString(),
    }));
  }

  // 单个档位（缺失或已下架抛 50006）
  async getPlan(code: string) {
    const plan = await this.prisma.boostPlan.findUnique({ where: { code } });
    if (!plan || !plan.enabled) {
      throw new BizException(50006, '该推广档位不存在或已下架', HttpStatus.NOT_FOUND);
    }
    return plan;
  }

  // 应用推广：现推广未到期则累加续费（base = max(now, 现 boostUntil) + durationHours），到期则从现在起算。
  // 在支付事务内调用（tx），保证「扣款成功 → 推广生效」原子。
  async applyBoost(
    targetType: BoostTargetType,
    targetId: string,
    durationHours: number,
    tx: Prisma.TransactionClient,
  ): Promise<Date> {
    const now = Date.now();
    if (targetType === 'post') {
      const post = await tx.post.findUnique({ where: { id: targetId }, select: { boostUntil: true } });
      if (!post) throw new BizException(50007, '表白墙内容不存在', HttpStatus.NOT_FOUND);
      const base = post.boostUntil && post.boostUntil.getTime() > now ? post.boostUntil : new Date(now);
      const until = new Date(base.getTime() + durationHours * 3_600_000);
      await tx.post.update({ where: { id: targetId }, data: { boostUntil: until } });
      return until;
    }
    const anon = await tx.anonymousPost.findUnique({ where: { id: targetId }, select: { boostUntil: true } });
    if (!anon) throw new BizException(50007, '树洞内容不存在', HttpStatus.NOT_FOUND);
    const base = anon.boostUntil && anon.boostUntil.getTime() > now ? anon.boostUntil : new Date(now);
    const until = new Date(base.getTime() + durationHours * 3_600_000);
    await tx.anonymousPost.update({ where: { id: targetId }, data: { boostUntil: until } });
    return until;
  }

  // 退款时裁剪推广：若仍处推广期则 boostUntil 置 now（立即结束推广），不在推广期则 no-op。
  async applyBoostRefund(
    targetType: BoostTargetType,
    targetId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const active = { gt: new Date() };
    if (targetType === 'post') {
      await tx.post.updateMany({ where: { id: targetId, boostUntil: active }, data: { boostUntil: new Date() } });
      return;
    }
    await tx.anonymousPost.updateMany({ where: { id: targetId, boostUntil: active }, data: { boostUntil: new Date() } });
  }

  // 清理过期推广：把 boostUntil <= now 的 Post/AnonymousPost 字段置回 null（数据整洁）。
  // 懒过滤（boostUntil > now）已保证 feed 正确，此方法仅做整洁清理，无功能影响；
  // 推广历史保留在 PaymentOrder（scene=POST_BOOST/ANON_POST_BOOST + boostPlanId + 时间），不依赖此字段。
  // Prisma lte 在 SQL 层为 `boost_until <= now`，NULL 行经三值逻辑被排除（NULL <= now = unknown），故仅清理非 null 且过期的行。
  async cleanupExpiredBoosts(): Promise<{ posts: number; anonPosts: number }> {
    const now = new Date();
    const [posts, anonPosts] = await Promise.all([
      this.prisma.post.updateMany({ where: { boostUntil: { lte: now } }, data: { boostUntil: null } }),
      this.prisma.anonymousPost.updateMany({ where: { boostUntil: { lte: now } }, data: { boostUntil: null } }),
    ]);
    return { posts: posts.count, anonPosts: anonPosts.count };
  }
}
