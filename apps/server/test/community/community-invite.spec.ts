/**
 * 圈子好友邀请回归测试：全部使用 Prisma mock，不连接数据库，不产生测试数据。
 */
import { HttpStatus } from '@nestjs/common';
import { CommunityMemberRole, CommunityStatus } from '@prisma/client';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { CommunityService } from '../../src/modules/community/community.service';

type TransactionMock = {
  communityMember: { createMany: jest.Mock };
  community: { updateMany: jest.Mock; update: jest.Mock };
  user: { update: jest.Mock };
};

function buildService(status: CommunityStatus | null, insertedCount: number) {
  const tx: TransactionMock = {
    communityMember: { createMany: jest.fn().mockResolvedValue({ count: insertedCount }) },
    community: {
      updateMany: jest.fn().mockResolvedValue({ count: status === CommunityStatus.ACTIVE ? 1 : 0 }),
      update: jest.fn().mockResolvedValue({ id: 'community_a' }),
    },
    user: { update: jest.fn().mockResolvedValue({ id: 'user_a' }) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: TransactionMock) => Promise<unknown>) => callback(tx)),
  };
  const service = new CommunityService(prisma as never, {} as never);
  return { service, prisma, tx };
}

describe('CommunityService.acceptInvite', () => {
  it('未加入用户应新增圈友、memberCount +1，并切换当前圈子', async () => {
    const { service, tx } = buildService(CommunityStatus.ACTIVE, 1);

    await expect(service.acceptInvite('user_a', 'community_a')).resolves.toEqual({
      id: 'community_a',
      joined: true,
    });
    expect(tx.community.updateMany).toHaveBeenCalledWith({
      where: { id: 'community_a', status: CommunityStatus.ACTIVE },
      data: { status: CommunityStatus.ACTIVE },
    });
    expect(tx.communityMember.createMany).toHaveBeenCalledWith({
      data: [{ communityId: 'community_a', userId: 'user_a', role: CommunityMemberRole.MEMBER }],
      skipDuplicates: true,
    });
    expect(tx.community.update).toHaveBeenCalledWith({
      where: { id: 'community_a' },
      data: { memberCount: { increment: 1 } },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user_a' },
      data: { activeCommunityId: 'community_a' },
    });
  });

  it('已是圈友时应保持幂等，不增加 memberCount，但仍切换当前圈子', async () => {
    const { service, tx } = buildService(CommunityStatus.ACTIVE, 0);

    await expect(service.acceptInvite('user_a', 'community_a')).resolves.toEqual({
      id: 'community_a',
      joined: false,
    });
    expect(tx.community.update).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user_a' },
      data: { activeCommunityId: 'community_a' },
    });
  });

  it.each([null, CommunityStatus.DISABLED])('圈子不存在或不可用（%s）时应拒绝邀请', async (status) => {
    const { service, prisma, tx } = buildService(status, 1);

    let caught: unknown;
    try {
      await service.acceptInvite('user_a', 'community_a');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BizException);
    const biz = caught as BizException;
    expect(biz.bizCode).toBe(80011);
    expect(biz.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.community.updateMany).toHaveBeenCalledWith({
      where: { id: 'community_a', status: CommunityStatus.ACTIVE },
      data: { status: CommunityStatus.ACTIVE },
    });
    expect(tx.communityMember.createMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('CommunityService.join', () => {
  it('普通加入遇到已有圈友时应保持原 80012 语义且不切换当前圈子', async () => {
    const { service, tx } = buildService(CommunityStatus.ACTIVE, 0);

    let caught: unknown;
    try {
      await service.join('user_a', 'community_a');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BizException);
    expect((caught as BizException).bizCode).toBe(80012);
    expect(tx.communityMember.createMany).toHaveBeenCalledTimes(1);
    expect(tx.community.update).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

describe('CommunityService 圈子广场动态数', () => {
  const community = {
    id: 'community_a',
    name: '测试圈子',
    logo: null,
    backgroundImage: null,
    description: '测试简介',
    category: '校园',
    region: '北京',
    location: '测试大学',
    memberCount: 12,
    postCount: 99,
    status: CommunityStatus.ACTIVE,
    rejectReason: null,
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
  };

  function buildCountService() {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ activeCommunityId: community.id }) },
      community: { findUnique: jest.fn().mockResolvedValue(community) },
      communityMember: {
        findUnique: jest.fn().mockResolvedValue({ role: CommunityMemberRole.MEMBER }),
      },
      post: { count: jest.fn().mockResolvedValue(2) },
      anonymousPost: { count: jest.fn().mockResolvedValue(3) },
      jobPost: { count: jest.fn().mockResolvedValue(4) },
    };
    return { service: new CommunityService(prisma as never, {} as never), prisma };
  }

  it('当前圈子应实时返回表白墙、树洞、有效兼职的混合动态总数', async () => {
    const { service, prisma } = buildCountService();

    await expect(service.getActive('user_a')).resolves.toMatchObject({ postCount: 9 });
    expect(prisma.post.count).toHaveBeenCalledWith({
      where: {
        communityId: community.id,
        status: 'APPROVED',
        visibility: 'PUBLIC',
        deletedAt: null,
      },
    });
    expect(prisma.anonymousPost.count).toHaveBeenCalledWith({
      where: { communityId: community.id, status: 'APPROVED' },
    });
    expect(prisma.jobPost.count).toHaveBeenCalledWith({
      where: {
        communityId: community.id,
        status: 'PUBLISHED',
        deletedAt: null,
        expireAt: { gt: expect.any(Date) },
      },
    });
  });

  it('圈子详情接口也应重新计算动态数，供菜单展开时刷新', async () => {
    const { service, prisma } = buildCountService();
    prisma.post.count.mockResolvedValue(5);
    prisma.anonymousPost.count.mockResolvedValue(1);
    prisma.jobPost.count.mockResolvedValue(2);

    await expect(service.detail('user_a', community.id)).resolves.toMatchObject({ postCount: 8 });
    expect(prisma.post.count).toHaveBeenCalledTimes(1);
    expect(prisma.anonymousPost.count).toHaveBeenCalledTimes(1);
    expect(prisma.jobPost.count).toHaveBeenCalledTimes(1);
  });
});

describe('CommunityService 圈子图片内容安全', () => {
  const dto = {
    name: '测试圈子',
    logo: 'https://example.com/logo.png',
    backgroundImage: 'https://example.com/background.png',
    description: '圈子简介',
    category: '校园',
    region: '北京',
    location: '测试大学',
  };

  it('创建圈子时应审核 LOGO 和背景图，命中违规后不写数据库', async () => {
    const violation = new BizException(90002, '图片包含违规内容，请更换后重试');
    const prisma = { appConfig: { findUnique: jest.fn() } };
    const moderation = {
      checkText: jest.fn().mockResolvedValue(undefined),
      checkImage: jest.fn((url: string) =>
        url.includes('background') ? Promise.reject(violation) : Promise.resolve(),
      ),
    };
    const service = new CommunityService(prisma as never, moderation as never);

    await expect(service.create('user_a', dto, 'openid_a')).rejects.toBe(violation);
    expect(moderation.checkImage).toHaveBeenCalledTimes(2);
    expect(moderation.checkImage).toHaveBeenCalledWith(dto.logo);
    expect(moderation.checkImage).toHaveBeenCalledWith(dto.backgroundImage);
    expect(prisma.appConfig.findUnique).not.toHaveBeenCalled();
  });

  it('重新提交被拒圈子时应重新审核 LOGO 和背景图，命中违规后不进入事务', async () => {
    const violation = new BizException(90002, '图片包含违规内容，请更换后重试');
    const community = {
      id: 'community_a',
      ownerId: 'user_a',
      status: CommunityStatus.DISABLED,
      rejectReason: '图片不合规',
      ...dto,
    };
    const prisma = {
      community: { findUnique: jest.fn().mockResolvedValue(community) },
      $transaction: jest.fn(),
    };
    const moderation = {
      checkText: jest.fn().mockResolvedValue(undefined),
      checkImage: jest.fn((url: string) =>
        url.includes('background') ? Promise.reject(violation) : Promise.resolve(),
      ),
    };
    const service = new CommunityService(prisma as never, moderation as never);

    await expect(service.resubmit('community_a', 'user_a')).rejects.toBe(violation);
    expect(moderation.checkImage).toHaveBeenCalledTimes(2);
    expect(moderation.checkImage).toHaveBeenCalledWith(dto.logo);
    expect(moderation.checkImage).toHaveBeenCalledWith(dto.backgroundImage);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
