import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { FavoriteTargetType } from './dto/toggle-favorite.dto';

// 错误码 7xxxx 收藏段：70001 目标类型不支持 / 70002 目标不存在 / 70003 收藏不存在
@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  // toggle：存在则删除（favorited=false），不存在则创建（favorited=true）
  // target 跨表存在性校验（post / anon_post / job_post），避免收藏悬空目标
  async toggle(uid: string, targetType: FavoriteTargetType, targetId: string) {
    await this.assertTargetExists(targetType, targetId);

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_targetType_targetId: { userId: uid, targetType, targetId } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    const f = await this.prisma.favorite.create({
      data: { userId: uid, targetType, targetId },
    });
    return { favorited: true, id: f.id };
  }

  // 列表：可按 targetType 过滤；page/pageSize 分页
  async list(
    uid: string,
    opts: { targetType?: FavoriteTargetType; page: number; pageSize: number },
  ) {
    const where: Prisma.FavoriteWhereInput = { userId: uid };
    if (opts.targetType) where.targetType = opts.targetType;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return { list: items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async delete(uid: string, id: string) {
    const f = await this.prisma.favorite.findUnique({ where: { id } });
    if (!f) throw new BizException(70003, '收藏不存在', HttpStatus.NOT_FOUND);
    if (f.userId !== uid) throw new BizException(10003, '无权操作', HttpStatus.FORBIDDEN);
    await this.prisma.favorite.delete({ where: { id } });
    return { deleted: true };
  }

  // 跨表存在性校验
  private async assertTargetExists(targetType: FavoriteTargetType, targetId: string) {
    let exists: { id: string } | null = null;
    switch (targetType) {
      case 'post':
        exists = await this.prisma.post.findUnique({ where: { id: targetId }, select: { id: true } });
        break;
      case 'anon_post':
        exists = await this.prisma.anonymousPost.findUnique({ where: { id: targetId }, select: { id: true } });
        break;
      case 'job_post':
        exists = await this.prisma.jobPost.findUnique({ where: { id: targetId }, select: { id: true } });
        break;
    }
    if (!exists) throw new BizException(70002, '收藏目标不存在', HttpStatus.NOT_FOUND);
  }
}