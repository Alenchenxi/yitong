import { CommunityStatus } from '@prisma/client';
import { AdminService } from '../../src/modules/admin/admin.service';
import type { AdminAccessContext } from '../../src/modules/admin/admin-access.service';

const access: AdminAccessContext = {
  adminId: 'admin_platform',
  openid: 'openid_platform',
  adminTypeId: 'type_platform',
  adminTypeName: '平台管理员',
  isPlatform: true,
  allCommunities: true,
  communityIds: [],
  permissions: [],
};

function buildService(status: CommunityStatus, id = 'community_a', updateCount = 1) {
  const tx = {
    community: {
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
    },
    adminAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  };
  const prisma = {
    community: {
      findUnique: jest.fn().mockResolvedValue({ id, status, deletedAt: null }),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const confession = { invalidateFeedCache: jest.fn() };
  const accessService = {
    assertCommunity: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AdminService(
    prisma as never,
    confession as never,
    {} as never,
    {} as never,
    accessService as never,
  );
  return { service, prisma, tx, confession };
}

describe('管理端删除圈子', () => {
  it('在同一事务内条件软删除已禁用圈子并写审计日志', async () => {
    const { service, tx, confession } = buildService(CommunityStatus.DISABLED);
    await expect(service.deleteCommunity('community_a', access)).resolves.toMatchObject({
      id: 'community_a',
      deleted: true,
    });
    expect(tx.community.updateMany).toHaveBeenCalledWith({
      where: { id: 'community_a', status: CommunityStatus.DISABLED, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorAdminId: access.adminId,
        actorOpenid: access.openid,
        action: 'community.delete',
        targetType: 'community',
        targetId: 'community_a',
      },
    });
    expect(confession.invalidateFeedCache).toHaveBeenCalledTimes(1);
  });

  it('并发启用导致条件更新未命中时回滚并拒绝删除', async () => {
    const { service, tx, confession } = buildService(CommunityStatus.DISABLED, 'community_a', 0);
    await expect(service.deleteCommunity('community_a', access)).rejects.toMatchObject({
      bizCode: 40004,
    });
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
    expect(confession.invalidateFeedCache).not.toHaveBeenCalled();
  });

  it('启用中的圈子不能删除', async () => {
    const { service, prisma } = buildService(CommunityStatus.ACTIVE);
    await expect(service.deleteCommunity('community_a', access)).rejects.toMatchObject({ bizCode: 40004 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('默认圈子即使禁用也不能删除', async () => {
    const { service, prisma } = buildService(CommunityStatus.DISABLED, 'cm_default');
    await expect(service.deleteCommunity('cm_default', access)).rejects.toMatchObject({ bizCode: 10003 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});