/**
 * switchRole service 单测（mock Prisma + JwtService + ConfigService + ReferralService）
 *
 * 覆盖以下场景：
 *  A) USER+MERCHANT+ADMIN 三角色 + AdminUser openid 绑定 -> switchRole('admin') 成功，issueTokens 调一次
 *  B) [核心 bug 修复] USER+MERCHANT + UserRole.ADMIN 残留 + AdminUser 无 openid -> 抛 10003
 *  C) USER+MERCHANT + Merchant 未审核/被驳回 -> switchRole('merchant') 拒绝；无资料仍保留注册入口
 *  D) 只有 USER -> switchRole('merchant') 抛 10003「未拥有该角色...」
 *
 * 全部 mock，不连真实 DB，不动 docker。
 */

import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, type User } from '@prisma/client';
import { AuthService } from '../../src/modules/auth/auth.service';
import { ReferralService } from '../../src/modules/referral/referral.service';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { PrismaService } from '../../src/prisma/prisma.service';

// ----- 测试 fixture -----
const USER_X: User = {
  id: 'u_x',
  openid: 'openid_x',
  unionid: null,
  nickname: 'User X',
  avatarUrl: null,
  gender: null,
  birthday: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as User;

const USER_Y: User = {
  id: 'u_y',
  openid: 'openid_y',
  unionid: null,
  nickname: 'User Y',
  avatarUrl: null,
  gender: null,
  birthday: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as User;

const USER_Z: User = {
  id: 'u_z',
  openid: 'openid_z',
  unionid: null,
  nickname: 'User Z',
  avatarUrl: null,
  gender: null,
  birthday: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as User;

const USER_W: User = {
  id: 'u_w',
  openid: 'openid_w',
  unionid: null,
  nickname: 'User W',
  avatarUrl: null,
  gender: null,
  birthday: null,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as User;

// ----- mock prisma builder -----
type PrismaMock = {
  user: { findUnique: jest.Mock };
  userRole: { findUnique: jest.Mock; findMany: jest.Mock };
  merchant: { findUnique: jest.Mock };
  adminUser: { findFirst: jest.Mock };
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

function buildPrismaMock(opts: {
  user: User;
  userRoleByUserRole: Record<string, { id: string; userId: string; role: Role } | null>;
  merchantByUserId?: { id: string; userId: string; status: string } | null;
  adminUserByOpenid?: { id: string; openid: string | null } | null;
  // toUserVo fallback：userRole.findMany 返回的角色列表
  userRoleList?: { role: Role }[];
}): PrismaMock {
  const userRoleFindUnique = jest.fn(async (args: { where: { userId_role: { userId: string; role: Role } } }) => {
    const key = `${args.where.userId_role.userId}::${args.where.userId_role.role}`;
    return opts.userRoleByUserRole[key] ?? null;
  });
  const userRoleFindMany = jest.fn(async () => opts.userRoleList ?? []);
  const merchantFindUnique = jest.fn(async (args: { where: { userId: string } }) => {
    if (opts.merchantByUserId === undefined) return null;
    if (opts.merchantByUserId && opts.merchantByUserId.userId === args.where.userId) {
      return opts.merchantByUserId;
    }
    return null;
  });
  const adminUserFindFirst = jest.fn(async (args: { where: { openid: string } }) => {
    if (!opts.adminUserByOpenid) return null;
    if (opts.adminUserByOpenid.openid === args.where.openid) return opts.adminUserByOpenid;
    return null;
  });
  const userFindUnique = jest.fn(async (args: { where: { id: string } | { openid: string } }) => {
    if ('id' in args.where && args.where.id === opts.user.id) return opts.user;
    if ('openid' in args.where && args.where.openid === opts.user.openid) return { id: opts.user.id };
    return null;
  });

  return {
    user: { findUnique: userFindUnique },
    userRole: { findUnique: userRoleFindUnique, findMany: userRoleFindMany },
    merchant: { findUnique: merchantFindUnique },
    adminUser: { findFirst: adminUserFindFirst },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

async function buildModule(prismaMock: PrismaMock): Promise<{
  service: AuthService;
  jwtSignMock: jest.Mock;
  jwtVerifyMock: jest.Mock;
  prisma: PrismaMock;
}> {
  const jwtSignMock = jest.fn().mockResolvedValue('signed.jwt.token');
  const jwtVerifyMock = jest.fn();
  const configGetMock = jest.fn().mockImplementation((key: string) => {
    if (key === 'MODE') return 'prod';
    return undefined;
  });

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prismaMock },
      {
        provide: JwtService,
        useValue: { signAsync: jwtSignMock, verifyAsync: jwtVerifyMock },
      },
      { provide: ConfigService, useValue: { get: configGetMock } },
      {
        provide: ReferralService,
        useValue: { onUserRegistered: jest.fn().mockResolvedValue(undefined) },
      },
    ],
  }).compile();

  return {
    service: moduleRef.get(AuthService),
    jwtSignMock,
    jwtVerifyMock,
    prisma: prismaMock,
  };
}

// ============================================================================
// 场景 A: USER+MERCHANT+ADMIN + AdminUser openid 绑定 -> admin 切换成功
// ============================================================================
describe('AuthService.switchRole 场景 A: USER+MERCHANT+ADMIN + AdminUser 绑定', () => {
  it('switchRole(\'admin\') 应签 access+refresh token（issueTokens 触发 2 次 signAsync）', async () => {
    const prismaMock = buildPrismaMock({
      user: USER_X,
      userRoleByUserRole: {
        'u_x::USER': { id: 'ur1', userId: 'u_x', role: Role.USER },
        'u_x::MERCHANT': { id: 'ur2', userId: 'u_x', role: Role.MERCHANT },
        'u_x::ADMIN': { id: 'ur3', userId: 'u_x', role: Role.ADMIN },
      },
      adminUserByOpenid: { id: 'au_x', openid: 'openid_x' },
      userRoleList: [{ role: Role.USER }, { role: Role.MERCHANT }, { role: Role.ADMIN }],
    });
    const { service, jwtSignMock, prisma } = await buildModule(prismaMock);

    const result = await service.switchRole('u_x', 'admin');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toBe('signed.jwt.token');
    expect(result.role).toBe(Role.ADMIN);
    // issueTokens -> signAsync 调用 2 次（access + refresh）
    expect(jwtSignMock).toHaveBeenCalledTimes(2);
    const firstCall = jwtSignMock.mock.calls[0]?.[0] as { type: string; uid: string; role: string };
    expect(firstCall.type).toBe('access');
    expect(firstCall.uid).toBe('u_x');
    expect(firstCall.role).toBe(Role.ADMIN);
    // adminUser.findFirst 调用 2 次（P2-66 起 toUserVo 附带 adminTypeName 解析）：
    // 第 1 次：switchRole 的 ADMIN 资格校验（active 管理员类型过滤）
    // 第 2 次：issueTokens -> toUserVo 的管理员类型名解析（仅按 openid 查，取 adminType.name）
    expect(prisma.adminUser.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.adminUser.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        openid: 'openid_x',
        adminType: { active: true, deletedAt: null },
      },
    });
    expect(prisma.adminUser.findFirst).toHaveBeenNthCalledWith(2, {
      where: { openid: 'openid_x' },
      select: { adminType: { select: { name: true } } },
    });
    // fixture 未绑定 adminType -> adminTypeName 回落 null（前端显示「管理员」）
    expect(result.user.adminTypeName).toBeNull();
  });
});

// ============================================================================
// 场景 B [核心]: UserRole.ADMIN 残留 + AdminUser 无 openid -> admin 切换被拒 10003
// ============================================================================
describe('AuthService.switchRole 场景 B [核心]: UserRole.ADMIN 残留 + 无 AdminUser 绑定', () => {
  it('switchRole(\'admin\') 应抛 BizException(10003, FORBIDDEN) 且 adminUser.findFirst 被调并返回 null', async () => {
    const prismaMock = buildPrismaMock({
      user: USER_Y,
      userRoleByUserRole: {
        'u_y::USER': { id: 'ur1', userId: 'u_y', role: Role.USER },
        'u_y::MERCHANT': { id: 'ur2', userId: 'u_y', role: Role.MERCHANT },
        // 历史脏数据：UserRole.ADMIN 行残留
        'u_y::ADMIN': { id: 'ur3', userId: 'u_y', role: Role.ADMIN },
      },
      // AdminUser 表无 openid 绑定（dev 模式 wx-login ensureRole 跳过 admin 校验的历史产物）
      adminUserByOpenid: null,
    });
    const { service, jwtSignMock, prisma } = await buildModule(prismaMock);

    let caught: unknown;
    try {
      await service.switchRole('u_y', 'admin');
    } catch (e) {
      caught = e;
    }

    // 1) 抛 BizException
    expect(caught).toBeInstanceOf(BizException);
    const biz = caught as BizException;
    expect(biz.bizCode).toBe(10003);
    expect(biz.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(String(biz.message)).toContain('未绑定管理员');

    // 2) adminUser.findFirst 必须被调用（核心修复点：switchRole 末尾的 ADMIN 二次校验）
    expect(prisma.adminUser.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.adminUser.findFirst).toHaveBeenCalledWith({
      where: {
        openid: 'openid_y',
        adminType: { active: true, deletedAt: null },
      },
    });

    // 3) signAsync 不应被调用（未签 token）
    expect(jwtSignMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 场景 C: 商家审核状态限制 merchant 角色切换
// ============================================================================
describe('AuthService.switchRole 场景 C: 商家审核状态限制', () => {
  it.each([
    ['PENDING', { id: 'm_z', userId: 'u_z', status: 'PENDING' }],
    ['REJECTED', { id: 'm_z', userId: 'u_z', status: 'REJECTED' }],
  ])('Merchant %s 时 switchRole(\'merchant\') 应拒绝 60003', async (_label, merchantByUserId) => {
    const prismaMock = buildPrismaMock({
      user: USER_Z,
      userRoleByUserRole: {
        'u_z::USER': { id: 'ur1', userId: 'u_z', role: Role.USER },
        'u_z::MERCHANT': { id: 'ur2', userId: 'u_z', role: Role.MERCHANT },
      },
      merchantByUserId,
      userRoleList: [{ role: Role.USER }, { role: Role.MERCHANT }],
    });
    const { service, jwtSignMock, prisma } = await buildModule(prismaMock);

    await expect(service.switchRole('u_z', 'merchant')).rejects.toMatchObject({ bizCode: 60003 });
    expect(jwtSignMock).not.toHaveBeenCalled();
    expect(prisma.merchant.findUnique).toHaveBeenCalledWith({ where: { userId: 'u_z' } });
  });

  it('尚无商家资料时保留商家注册入口并允许签发 token', async () => {
    const prismaMock = buildPrismaMock({
      user: USER_Z,
      userRoleByUserRole: {
        'u_z::USER': { id: 'ur1', userId: 'u_z', role: Role.USER },
        'u_z::MERCHANT': { id: 'ur2', userId: 'u_z', role: Role.MERCHANT },
      },
      merchantByUserId: null,
      userRoleList: [{ role: Role.USER }, { role: Role.MERCHANT }],
    });
    const { service, jwtSignMock, prisma } = await buildModule(prismaMock);

    const result = await service.switchRole('u_z', 'merchant');

    expect(result.role).toBe(Role.MERCHANT);
    expect(jwtSignMock).toHaveBeenCalledTimes(2);
    expect(prisma.merchant.findUnique).toHaveBeenCalledWith({ where: { userId: 'u_z' } });
  });
});
// ============================================================================
// 场景 D: 只有 USER 角色 -> merchant 切换被拒 10003「未拥有该角色...」
// ============================================================================
describe('AuthService.switchRole 场景 D: 只有 USER 角色', () => {
  it('switchRole(\'merchant\') 应抛 BizException(10003, FORBIDDEN)', async () => {
    const prismaMock = buildPrismaMock({
      user: USER_W,
      userRoleByUserRole: {
        'u_w::USER': { id: 'ur1', userId: 'u_w', role: Role.USER },
        // MERCHANT 角色缺失
      },
    });
    const { service, jwtSignMock, prisma } = await buildModule(prismaMock);

    let caught: unknown;
    try {
      await service.switchRole('u_w', 'merchant');
    } catch (e) {
      caught = e;
    }

    // 1) 抛 10003「未拥有该角色...」
    expect(caught).toBeInstanceOf(BizException);
    const biz = caught as BizException;
    expect(biz.bizCode).toBe(10003);
    expect(biz.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(String(biz.message)).toContain('未拥有该角色');

    // 2) userRole.findUnique 应被调用一次查 MERCHANT
    expect(prisma.userRole.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.userRole.findUnique).toHaveBeenCalledWith({
      where: { userId_role: { userId: 'u_w', role: Role.MERCHANT } },
    });

    // 3) merchant / adminUser 不应被查询
    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
    expect(prisma.adminUser.findFirst).not.toHaveBeenCalled();

    // 4) signAsync 不应被调用
    expect(jwtSignMock).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 场景 E: merchant refreshToken 必须实时校验商家审核状态
// ============================================================================
describe('AuthService.refresh 场景 E: 商家审核状态限制', () => {
  it.each([
    ['PENDING', { id: 'm_z', userId: 'u_z', status: 'PENDING' }],
    ['REJECTED', { id: 'm_z', userId: 'u_z', status: 'REJECTED' }],
  ])('Merchant %s 时 refresh 应拒绝 60003', async (_label, merchantByUserId) => {
    const prismaMock = buildPrismaMock({
      user: USER_Z,
      userRoleByUserRole: {
        'u_z::USER': { id: 'ur1', userId: 'u_z', role: Role.USER },
        'u_z::MERCHANT': { id: 'ur2', userId: 'u_z', role: Role.MERCHANT },
      },
      merchantByUserId,
      userRoleList: [{ role: Role.USER }, { role: Role.MERCHANT }],
    });
    const { service, jwtSignMock, jwtVerifyMock } = await buildModule(prismaMock);
    jwtVerifyMock.mockResolvedValue({ uid: 'u_z', role: Role.MERCHANT, type: 'refresh' });

    await expect(service.refresh('refresh.token')).rejects.toMatchObject({ bizCode: 60003 });
    expect(jwtSignMock).not.toHaveBeenCalled();
  });
});
