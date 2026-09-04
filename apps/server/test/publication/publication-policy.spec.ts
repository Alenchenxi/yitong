import { PublicationPolicyService } from '../../src/modules/publication/publication-policy.service';
import { BizException } from '../../src/common/exceptions/biz.exception';

function buildService(options: {
  banned?: boolean;
  platformBanned?: boolean;
  anonymousUserId?: string | null;
} = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        deletedAt: options.platformBanned ? new Date('2026-09-04T00:00:00.000Z') : null,
      }),
    },
    communityUserBan: {
      findFirst: jest.fn().mockResolvedValue(
        options.banned ? { id: 'ban_1' } : null,
      ),
    },
    anonymousProfile: {
      findUnique: jest.fn().mockResolvedValue(
        options.anonymousUserId === null
          ? null
          : { userId: options.anonymousUserId ?? 'user_1' },
      ),
    },
  };
  return {
    service: new PublicationPolicyService(prisma as never),
    prisma,
  };
}

describe('PublicationPolicyService 圈子封禁', () => {
  it('有效圈子封禁应拒绝实名内容互动', async () => {
    const { service, prisma } = buildService({ banned: true });

    await expect(
      service.assertCommunityInteractionAllowed('user_1', 'community_a'),
    ).rejects.toMatchObject<Partial<BizException>>({
      bizCode: 80015,
    });
    expect(prisma.communityUserBan.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        communityId: 'community_a',
        active: true,
      },
      select: { id: true },
    });
  });

  it('平台封禁应拒绝持有旧 access token 的实名内容互动', async () => {
    const { service } = buildService({ platformBanned: true });

    await expect(
      service.assertCommunityInteractionAllowed('user_1', 'community_a'),
    ).rejects.toMatchObject<Partial<BizException>>({ bizCode: 10005 });
  });

  it('匿名互动应只在策略内部映射真实用户后复用同一封禁规则', async () => {
    const { service, prisma } = buildService({
      banned: false,
      anonymousUserId: 'user_1',
    });

    await expect(
      service.assertAnonCommunityInteractionAllowed('anon_1', 'community_a'),
    ).resolves.toBeUndefined();
    expect(prisma.anonymousProfile.findUnique).toHaveBeenCalledWith({
      where: { anonId: 'anon_1' },
      select: { userId: true },
    });
    expect(prisma.communityUserBan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user_1' }),
      }),
    );
  });

  it('匿名身份不存在时应返回匿名态错误且不查询封禁记录', async () => {
    const { service, prisma } = buildService({ anonymousUserId: null });

    await expect(
      service.assertAnonCommunityInteractionAllowed('anon_missing', 'community_a'),
    ).rejects.toMatchObject<Partial<BizException>>({
      bizCode: 30001,
    });
    expect(prisma.communityUserBan.findFirst).not.toHaveBeenCalled();
  });

  it('事务内复核应先锁用户和封禁集合再拒绝有效圈子封禁', async () => {
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([{ id: 'user_1', deletedAt: null }])
      .mockResolvedValueOnce([{ id: 'ban_1', active: true }]);
    const service = new PublicationPolicyService({} as never);
    const tx = { $queryRawUnsafe: queryRaw };

    await expect(
      service.assertCommunityInteractionAllowedInTransaction(
        tx as never,
        'user_1',
        'community_a',
      ),
    ).rejects.toMatchObject<Partial<BizException>>({ bizCode: 80015 });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls[0]?.[0]).toContain('FROM "users"');
    expect(queryRaw.mock.calls[0]?.[0]).toContain('FOR UPDATE');
    expect(queryRaw.mock.calls[1]?.[0]).toContain('FROM "community_user_bans"');
    expect(queryRaw.mock.calls[1]?.[0]).toContain('FOR UPDATE');
  });

  it('事务内复核应在锁定用户后拒绝平台封禁账号', async () => {
    const queryRaw = jest.fn().mockResolvedValueOnce([
      { id: 'user_1', deletedAt: new Date('2026-09-04T00:00:00.000Z') },
    ]);
    const service = new PublicationPolicyService({} as never);
    const tx = { $queryRawUnsafe: queryRaw };

    await expect(
      service.assertCommunityInteractionAllowedInTransaction(
        tx as never,
        'user_1',
        'community_a',
      ),
    ).rejects.toMatchObject<Partial<BizException>>({ bizCode: 10005 });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0]?.[0]).toContain('"deleted_at" AS "deletedAt"');
    expect(queryRaw.mock.calls[0]?.[0]).toContain('FOR UPDATE');
  });

  it('平台内容事务内复核应锁定用户、管理员和管理员类型资格', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'admin_1' }]);
    const service = new PublicationPolicyService({} as never);
    const tx = { $queryRawUnsafe: queryRaw };

    await expect(
      service.assertOwnerCanManageInTransaction(
        tx as never,
        'user_1',
        'PLATFORM' as never,
      ),
    ).resolves.toBeUndefined();

    expect(queryRaw.mock.calls[0]?.[0]).toContain('FOR UPDATE OF u, au, at');
  });
});
