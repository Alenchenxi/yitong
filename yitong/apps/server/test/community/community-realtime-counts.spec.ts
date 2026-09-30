import { CommunityMemberRole, CommunityStatus } from '@prisma/client';
import { CommunityService } from '../../src/modules/community/community.service';

describe('CommunityService 圈子列表实时统计', () => {
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
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  function buildService({
    communities = [community],
    memberRows = [{ communityId: community.id, _count: { _all: 2 } }],
  }: {
    communities?: Array<typeof community>;
    memberRows?: Array<{ communityId: string; _count: { _all: number } }>;
  } = {}) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ activeCommunityId: community.id }),
      },
      community: {
        findMany: jest.fn().mockResolvedValue(communities),
        findUnique: jest.fn().mockResolvedValue(community),
      },
      communityMember: {
        findMany: jest.fn().mockImplementation((args: { include?: { community?: boolean } }) =>
          Promise.resolve([
            {
              communityId: community.id,
              role: CommunityMemberRole.MEMBER,
              ...(args.include?.community ? { community } : {}),
            },
          ]),
        ),
        groupBy: jest.fn().mockResolvedValue(memberRows),
        findUnique: jest.fn().mockResolvedValue({ role: CommunityMemberRole.MEMBER }),
        count: jest.fn().mockResolvedValue(2),
      },
      post: {
        groupBy: jest.fn().mockResolvedValue([
          { communityId: community.id, _count: { _all: 2 } },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
      anonymousPost: {
        groupBy: jest.fn().mockResolvedValue([
          { communityId: community.id, _count: { _all: 3 } },
        ]),
        count: jest.fn().mockResolvedValue(3),
      },
    };

    return new CommunityService(
      prisma as never,
      {} as never,
    );
  }

  it('圈子广场应返回真实圈友数和当前可见动态总数，而不是冗余字段旧值', async () => {
    const service = buildService();

    await expect(service.listPublic('user_a')).resolves.toEqual([
      expect.objectContaining({
        id: community.id,
        memberCount: 2,
        postCount: 5,
      }),
    ]);
  });

  it('圈子广场应按实时圈友数降序排列，并为相同人数提供稳定顺序', async () => {
    const olderCommunity = {
      ...community,
      id: 'community_older',
      name: '较早创建的圈子',
      memberCount: 100,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    };
    const newerCommunity = {
      ...community,
      id: 'community_newer',
      name: '较晚创建的圈子',
      memberCount: 50,
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
    };
    const sameTimeLaterIdCommunity = {
      ...community,
      id: 'community_z_same_time',
      name: '同时间但 ID 靠后的圈子',
      memberCount: 150,
      createdAt: olderCommunity.createdAt,
    };
    const mostPopularCommunity = {
      ...community,
      id: 'community_popular',
      name: '圈友最多的圈子',
      memberCount: 1,
      createdAt: new Date('2026-08-03T00:00:00.000Z'),
    };
    const service = buildService({
      communities: [
        sameTimeLaterIdCommunity,
        olderCommunity,
        newerCommunity,
        mostPopularCommunity,
      ],
      memberRows: [
        { communityId: sameTimeLaterIdCommunity.id, _count: { _all: 3 } },
        { communityId: olderCommunity.id, _count: { _all: 3 } },
        { communityId: newerCommunity.id, _count: { _all: 3 } },
        { communityId: mostPopularCommunity.id, _count: { _all: 8 } },
      ],
    });

    const result = await service.listPublic('user_a');

    expect(result.map((item) => item.id)).toEqual([
      mostPopularCommunity.id,
      olderCommunity.id,
      sameTimeLaterIdCommunity.id,
      newerCommunity.id,
    ]);
    expect(result.map((item) => item.memberCount)).toEqual([8, 3, 3, 3]);
  });

  it('我的圈子应在每次请求时返回真实圈友数和当前可见动态总数', async () => {
    const service = buildService();

    await expect(service.listMineAll('user_a')).resolves.toEqual(
      expect.objectContaining({
        joined: [
          expect.objectContaining({
            id: community.id,
            memberCount: 2,
            postCount: 5,
          }),
        ],
      }),
    );
  });

  it('圈子切换页的我的圈子列表也应返回实时统计', async () => {
    const service = buildService();

    await expect(service.listMine('user_a')).resolves.toEqual(
      expect.objectContaining({
        list: [
          expect.objectContaining({
            id: community.id,
            memberCount: 2,
            postCount: 5,
          }),
        ],
      }),
    );
  });

  it('广场头卡和菜单详情应同时刷新真实圈友数与动态数', async () => {
    const service = buildService();

    await expect(service.getActive('user_a')).resolves.toEqual(
      expect.objectContaining({ memberCount: 2, postCount: 5 }),
    );
    await expect(service.detail('user_a', community.id)).resolves.toEqual(
      expect.objectContaining({ memberCount: 2, postCount: 5 }),
    );
  });
});
