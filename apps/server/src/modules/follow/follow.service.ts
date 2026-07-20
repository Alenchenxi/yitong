import { HttpStatus, Injectable } from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

// 错误码 70004 关注段（70001-70003 收藏段占用）
@Injectable()
export class FollowService {
  constructor(private readonly prisma: PrismaService) {}

  // toggle 关注：已关注则取关，未关注则关注
  async toggle(followerId: string, followeeId: string) {
    if (followerId === followeeId) {
      throw new BizException(70004, '不能关注自己', HttpStatus.BAD_REQUEST);
    }
    const target = await this.prisma.user.findUnique({
      where: { id: followeeId },
      select: { id: true, deletedAt: true },
    });
    if (!target || target.deletedAt) {
      throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    }
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
    });
    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      return { following: false };
    }
    await this.prisma.follow.create({ data: { followerId, followeeId } });
    return { following: true };
  }

  // 查当前用户是否关注了目标
  async isFollowing(followerId: string, followeeId: string) {
    const f = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId, followeeId } },
      select: { id: true },
    });
    return { following: !!f };
  }
}
