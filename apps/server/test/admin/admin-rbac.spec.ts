import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAccessService, type AdminAccessContext } from '../../src/modules/admin/admin-access.service';
import { ADMIN_PERMISSION_KEY } from '../../src/modules/admin/admin-access.decorator';
import {
  ADMIN_PERMISSIONS,
  normalizeAdminPermissionCodes,
} from '../../src/modules/admin/admin-permissions';
import { AdminGuard } from '../../src/modules/auth/admin.guard';
import { BizException } from '../../src/common/exceptions/biz.exception';

const circleAccess: AdminAccessContext = {
  adminId: 'admin_circle',
  openid: 'openid_circle',
  adminTypeId: 'type_circle',
  adminTypeName: '圈子管理员',
  isPlatform: false,
  allCommunities: false,
  communityIds: ['community_a'],
  permissions: [
    ADMIN_PERMISSIONS.COMMUNITY_VIEW,
    ADMIN_PERMISSIONS.CONTENT_MODERATE,
  ],
};

function executionContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('AdminGuard RBAC', () => {
  it('管理员或类型停用后，已有 access token 也应立即失效', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const accessService = {
      resolve: jest.fn().mockResolvedValue(null),
    } as unknown as AdminAccessService;
    const guard = new AdminGuard(reflector, accessService);

    await expect(guard.canActivate(executionContext({
      user: { role: 'ADMIN', openid: 'openid_disabled' },
    }))).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('圈子管理员没有声明权限时应默认拒绝', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((_key: string) => undefined),
    } as unknown as Reflector;
    const accessService = {
      resolve: jest.fn().mockResolvedValue(circleAccess),
    } as unknown as AdminAccessService;
    const guard = new AdminGuard(reflector, accessService);

    await expect(guard.canActivate(executionContext({
      user: { role: 'ADMIN', openid: circleAccess.openid },
    }))).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('圈子管理员拥有声明权限时放行，并把访问上下文挂到 request', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ADMIN_PERMISSION_KEY ? [ADMIN_PERMISSIONS.CONTENT_MODERATE] : undefined),
    } as unknown as Reflector;
    const accessService = {
      resolve: jest.fn().mockResolvedValue(circleAccess),
    } as unknown as AdminAccessService;
    const guard = new AdminGuard(reflector, accessService);
    const request = { user: { role: 'ADMIN', openid: circleAccess.openid } };

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('adminAccess', circleAccess);
  });

  it('非平台管理员即使权限表含 admin.manage 也不能管理管理员', async () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ADMIN_PERMISSION_KEY ? [ADMIN_PERMISSIONS.ADMIN_MANAGE] : undefined),
    } as unknown as Reflector;
    const accessService = {
      resolve: jest.fn().mockResolvedValue({
        ...circleAccess,
        permissions: [...circleAccess.permissions, ADMIN_PERMISSIONS.ADMIN_MANAGE],
      }),
    } as unknown as AdminAccessService;
    const guard = new AdminGuard(reflector, accessService);

    await expect(guard.canActivate(executionContext({
      user: { role: 'ADMIN', openid: circleAccess.openid },
    }))).rejects.toMatchObject({ bizCode: 10003 });
  });
});

describe('AdminAccessService 圈子范围', () => {
  const service = new AdminAccessService({} as never);

  it('指定圈子管理员只能得到授权圈子的 SQL 条件', () => {
    expect(service.communityWhere(circleAccess)).toEqual({
      id: { in: ['community_a'] },
    });
    expect(service.communityIdWhere(circleAccess)).toEqual({
      in: ['community_a'],
    });
  });

  it('越权操作其他圈子应拒绝', async () => {
    await expect(service.assertCommunity(circleAccess, 'community_b'))
      .rejects.toBeInstanceOf(BizException);
  });

  it('平台管理员不追加圈子 SQL 条件', () => {
    const platformAccess = { ...circleAccess, isPlatform: true, allCommunities: true };
    expect(service.communityWhere(platformAccess)).toEqual({});
    expect(service.communityIdWhere(platformAccess)).toBeUndefined();
  });
});

describe('管理员类型权限依赖', () => {
  it.each([
    ADMIN_PERMISSIONS.BANNER_MANAGE,
    ADMIN_PERMISSIONS.COMMUNITY_EDIT,
    ADMIN_PERMISSIONS.COMMUNITY_REVIEW,
  ])('%s 必须自动包含查看圈子权限', (permission) => {
    expect(normalizeAdminPermissionCodes([permission])).toEqual([
      permission,
      ADMIN_PERMISSIONS.COMMUNITY_VIEW,
    ]);
  });

  it('不应重复写入查看圈子权限', () => {
    expect(normalizeAdminPermissionCodes([
      ADMIN_PERMISSIONS.COMMUNITY_VIEW,
      ADMIN_PERMISSIONS.COMMUNITY_EDIT,
      ADMIN_PERMISSIONS.COMMUNITY_VIEW,
    ])).toEqual([
      ADMIN_PERMISSIONS.COMMUNITY_VIEW,
      ADMIN_PERMISSIONS.COMMUNITY_EDIT,
    ]);
  });
});
