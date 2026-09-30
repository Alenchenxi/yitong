import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfessionService } from '../confession/confession.service';
import { NotificationService, NotificationType } from '../notification/notification.service';

// 错误码 70004 关注段（70001-70003 收藏段占用）
@Injectable()
export class FollowService {
  private readonly logger = new Logger(FollowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly confession: ConfessionService,
  ) {}

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
    // P0-11 关注通知（注明来源表白墙；followerId !== followeeId 已校验，取关不通知）
    void this.notification
      .createFromActor({
        actorUid: followerId,
        targetUid: followeeId,
        type: NotificationType.POST_FOLLOW,
        title: '表白墙 · 新粉丝',
        content: (a) => `${a} 关注了你`,
        targetType: 'user',
        targetId: followerId,
      })
      .catch((e: unknown) =>
        this.logger.warn(`notify follow failed: ${e instanceof Error ? e.message : String(e)}`),
      );
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

  // P2-55 表白墙实名用户主页：公开资料、关系统计和当前圈可见的非匿名动态。
  async getProfile(viewerId: string, targetId: string, page: number, pageSize: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true, nickname: true, avatarUrl: true },
    });
    if (!user) {
      throw new BizException(10001, '用户不存在', HttpStatus.NOT_FOUND);
    }
    const [following, followerCount, followingCount, posts] = await Promise.all([
      viewerId === targetId
        ? Promise.resolve(null)
        : this.prisma.follow.findUnique({
            where: {
              followerId_followeeId: {
                followerId: viewerId,
                followeeId: targetId,
              },
            },
            select: { id: true },
          }),
      this.prisma.follow.count({
        where: { followeeId: targetId, follower: { deletedAt: null } },
      }),
      this.prisma.follow.count({
        where: { followerId: targetId, followee: { deletedAt: null } },
      }),
      this.confession.listPublicAuthorPosts(viewerId, targetId, page, pageSize),
    ]);
    return {
      userId: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      isSelf: viewerId === targetId,
      following: !!following,
      followerCount,
      followingCount,
      postCount: posts.total,
      posts,
    };
  }

  // P1-09 关注列表：我（followerId）关注的人
  async listFollowing(uid: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: uid, followee: { deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { followee: { select: { id: true, nickname: true, avatarUrl: true } } },
      }),
      this.prisma.follow.count({ where: { followerId: uid, followee: { deletedAt: null } } }),
    ]);
    return {
      list: items.map((f) => ({
        userId: f.followee.id,
        nickname: f.followee.nickname,
        avatarUrl: f.followee.avatarUrl,
        followedAt: f.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // P1-09 粉丝列表：关注了我的人
  async listFollowers(uid: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followeeId: uid, follower: { deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { follower: { select: { id: true, nickname: true, avatarUrl: true } } },
      }),
      this.prisma.follow.count({ where: { followeeId: uid, follower: { deletedAt: null } } }),
    ]);
    return {
      list: items.map((f) => ({
        userId: f.follower.id,
        nickname: f.follower.nickname,
        avatarUrl: f.follower.avatarUrl,
        followedAt: f.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
