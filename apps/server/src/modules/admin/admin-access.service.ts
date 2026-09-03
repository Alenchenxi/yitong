import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_PERMISSION_CATALOG, type AdminPermissionCode } from './admin-permissions';

export interface AdminAccessContext {
  adminId: string;
  openid: string;
  adminTypeId: string;
  adminTypeName: string;
  isPlatform: boolean;
  allCommunities: boolean;
  communityIds: string[];
  permissions: AdminPermissionCode[];
}

@Injectable()
export class AdminAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(openid: string): Promise<AdminAccessContext | null> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { openid },
      include: {
        adminType: {
          include: {
            permissions: { include: { permission: { select: { code: true } } } },
          },
        },
        communityScopes: { select: { communityId: true } },
      },
    });
    if (!admin || !admin.adminType.active || admin.adminType.deletedAt) return null;
    const permissions = admin.adminType.isPlatform
      ? ADMIN_PERMISSION_CATALOG.map((item) => item.code)
      : admin.adminType.permissions.map((item) => item.permission.code as AdminPermissionCode);
    return {
      adminId: admin.id,
      openid,
      adminTypeId: admin.adminTypeId,
      adminTypeName: admin.adminType.name,
      isPlatform: admin.adminType.isPlatform,
      allCommunities: admin.adminType.isPlatform || admin.allCommunities,
      communityIds: admin.communityScopes.map((item) => item.communityId),
      permissions,
    };
  }

  communityWhere(access: AdminAccessContext): Prisma.CommunityWhereInput {
    return access.allCommunities ? {} : { id: { in: access.communityIds } };
  }

  communityIdWhere(access: AdminAccessContext): Prisma.StringFilter | string | undefined {
    return access.allCommunities ? undefined : { in: access.communityIds };
  }

  async assertCommunity(access: AdminAccessContext, communityId: string): Promise<void> {
    if (access.allCommunities || access.communityIds.includes(communityId)) return;
    throw new BizException(10003, '无权管理该圈子', HttpStatus.FORBIDDEN);
  }

  async audit(
    access: AdminAccessContext,
    action: string,
    targetType: string,
    targetId?: string,
    details?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        actorAdminId: access.adminId,
        actorOpenid: access.openid,
        action,
        targetType,
        targetId,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }
}
