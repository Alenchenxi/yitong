import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CommunityStatus,
  ContentVisibilityScope,
  PublicationScope,
  type Prisma,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PublicationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async isPlatformUser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { openid: true, deletedAt: true },
    });
    if (!user || user.deletedAt) return false;
    const admin = await this.prisma.adminUser.findUnique({
      where: { openid: user.openid },
      select: {
        adminType: {
          select: { active: true, deletedAt: true, isPlatform: true },
        },
      },
    });
    return !!admin?.adminType.isPlatform
      && admin.adminType.active
      && !admin.adminType.deletedAt;
  }

  async resolveForUser(userId: string): Promise<PublicationScope> {
    return (await this.isPlatformUser(userId))
      ? PublicationScope.PLATFORM
      : PublicationScope.COMMUNITY;
  }

  async resolveForAnon(anonId: string): Promise<PublicationScope> {
    const profile = await this.prisma.anonymousProfile.findUnique({
      where: { anonId },
      select: { userId: true },
    });
    return profile
      ? this.resolveForUser(profile.userId)
      : PublicationScope.COMMUNITY;
  }

  async assertOwnerCanManage(
    userId: string,
    publisherScope: PublicationScope,
  ): Promise<void> {
    if (
      publisherScope === PublicationScope.PLATFORM
      && !(await this.isPlatformUser(userId))
    ) {
      this.throwPlatformOwnerRequired();
    }
  }

  async assertOwnerCanManageInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    publisherScope: PublicationScope,
  ): Promise<void> {
    if (publisherScope !== PublicationScope.PLATFORM) return;
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT au."id"
       FROM "users" u
       JOIN "admin_users" au ON au."openid" = u."openid"
       JOIN "admin_types" at ON at."id" = au."admin_type_id"
       WHERE u."id" = $1
         AND at."is_platform" = TRUE
         AND at."active" = TRUE
         AND at."deleted_at" IS NULL
         AND u."deleted_at" IS NULL
       FOR UPDATE OF u, au, at`,
      userId,
    );
    if (rows.length === 0) this.throwPlatformOwnerRequired();
  }

  private throwPlatformOwnerRequired(): never {
    throw new BizException(
      10003,
      '平台发布内容仅限当前平台管理员管理',
      HttpStatus.FORBIDDEN,
    );
  }

  async assertCommunityInteractionAllowed(
    userId: string,
    communityId: string,
  ): Promise<void> {
    const [user, ban] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { deletedAt: true },
      }),
      this.prisma.communityUserBan.findFirst({
        where: { userId, communityId, active: true },
        select: { id: true },
      }),
    ]);
    if (!user || user.deletedAt) this.throwAccountBanned();
    if (ban) {
      throw new BizException(
        80015,
        '你已被当前圈子封禁',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async assertCommunityInteractionAllowedInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    communityId: string,
  ): Promise<void> {
    const users = await tx.$queryRawUnsafe<Array<{ id: string; deletedAt: Date | null }>>(
      `SELECT "id", "deleted_at" AS "deletedAt"
       FROM "users"
       WHERE "id" = $1
       FOR UPDATE`,
      userId,
    );
    if (!users[0] || users[0].deletedAt) this.throwAccountBanned();
    const bans = await tx.$queryRawUnsafe<Array<{ id: string; active: boolean }>>(
      `SELECT "id", "active"
       FROM "community_user_bans"
       WHERE "user_id" = $1 AND "community_id" = $2
       FOR UPDATE`,
      userId,
      communityId,
    );
    if (bans.some((ban) => ban.active)) {
      throw new BizException(
        80015,
        '你已被当前圈子封禁',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private throwAccountBanned(): never {
    throw new BizException(10005, '账号已被封禁', HttpStatus.FORBIDDEN);
  }

  async assertAnonCommunityInteractionAllowed(
    anonId: string,
    communityId: string,
  ): Promise<void> {
    const profile = await this.prisma.anonymousProfile.findUnique({
      where: { anonId },
      select: { userId: true },
    });
    if (!profile) {
      throw new BizException(30001, '匿名身份已失效', HttpStatus.UNAUTHORIZED);
    }
    await this.assertCommunityInteractionAllowed(profile.userId, communityId);
  }

  postVisibilityFilter(communityId: string): Prisma.PostWhereInput {
    return {
      OR: [
        {
          publisherScope: PublicationScope.PLATFORM,
          visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
        },
        {
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: ContentVisibilityScope.COMMUNITY,
          communityId,
          community: { is: { status: CommunityStatus.ACTIVE } },
        },
      ],
    };
  }

  anonymousPostVisibilityFilter(
    communityId: string,
  ): Prisma.AnonymousPostWhereInput {
    return {
      OR: [
        {
          publisherScope: PublicationScope.PLATFORM,
          visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
        },
        {
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: ContentVisibilityScope.COMMUNITY,
          communityId,
          community: { is: { status: CommunityStatus.ACTIVE } },
        },
      ],
    };
  }
}
