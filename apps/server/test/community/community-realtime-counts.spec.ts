import { CommunityMemberRole, CommunityStatus } from '@prisma/client';
import { CommunityService } from '../../src/modules/community/community.service';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';

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

  function buildService() {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ activeCommunityId: community.id }),
      },
      community: {
        findMany: jest.fn().mockResolvedValue([community]),
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
        groupBy: jest.fn().mockResolvedValue([
          { communityId: community.id, _count: { _all: 2 } },
        ]),
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
      jobPost: {
        groupBy: jest.fn().mockResolvedValue([
          { communityId: community.id, _count: { _all: 1 } },
        ]),
        count: jest.fn().mockImplementation((args: { where: { visibilityScope?: string } }) =>
          Promise.resolve(args.where.visibilityScope ? 3 : 4),
        ),
      },
    };

    return new CommunityService(
      prisma as never,
      {} as never,
      new JobVisibilityPolicyService(),
    );
  }

  it('圈子广场应返回真实圈友数和当前可见动态总数，而不是冗余字段旧值', async () => {
    const service = buildService();

    await expect(service.listPublic('user_a')).resolves.toEqual([
      expect.objectContaining({
        id: community.id,
        memberCount: 2,
        postCount: 9,
      }),
    ]);
  });

  it('我的圈子应在每次请求时返回真实圈友数和当前可见动态总数', async () => {
    const service = buildService();

    await expect(service.listMineAll('user_a')).resolves.toEqual(
      expect.objectContaining({
        joined: [
          expect.objectContaining({
            id: community.id,
            memberCount: 2,
            postCount: 9,
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
            postCount: 9,
          }),
        ],
      }),
    );
  });

  it('广场头卡和菜单详情应同时刷新真实圈友数与动态数', async () => {
    const service = buildService();

    await expect(service.getActive('user_a')).resolves.toEqual(
      expect.objectContaining({ memberCount: 2, postCount: 9 }),
    );
    await expect(service.detail('user_a', community.id)).resolves.toEqual(
      expect.objectContaining({ memberCount: 2, postCount: 9 }),
    );
  });
});
