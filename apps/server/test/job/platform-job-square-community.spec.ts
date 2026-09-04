import {
  CommunityStatus,
  ContentVisibilityScope,
  JobApplyMode,
  JobCategory,
  JobDuration,
  JobPostStatus,
  JobVisibilityScope,
  MerchantStatus,
  PostVisibility,
  PublicationScope,
  Settlement,
} from '@prisma/client';
import { CommunityService } from '../../src/modules/community/community.service';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';
import { JobService } from '../../src/modules/job/job.service';
import { PublicationPolicyService } from '../../src/modules/publication/publication-policy.service';
import { SquareService } from '../../src/modules/square/square.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';

const NOW = new Date('2026-09-04T08:00:00.000Z');

function jobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job_platform',
    merchantId: 'merchant_platform',
    communityId: 'community_a',
    title: '校园活动助理',
    description: '协助活动执行',
    requirements: null,
    contactPhoneSnapshot: '13800000000',
    contactWechatSnapshot: 'platform-job',
    salary: '150元/天',
    salaryAmount: 150,
    location: '大学生活动中心',
    locationPoiId: 'poi_a',
    locationLng: 116.4,
    locationLat: 39.9,
    locationCity: '北京',
    category: JobCategory.CATERING,
    customCategory: null,
    settlement: Settlement.DAILY,
    workDates: [],
    workPeriods: [],
    headcount: 2,
    urgent: false,
    featured: false,
    online: false,
    questions: [],
    duration: JobDuration.D30,
    expireAt: new Date('2026-10-04T08:00:00.000Z'),
    visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
    publisherScope: PublicationScope.PLATFORM,
    applyMode: JobApplyMode.IN_APP,
    publisherName: null,
    status: JobPostStatus.PENDING,
    takenDownAt: null,
    deletedAt: null,
    createdAt: NOW,
    merchant: {
      userId: 'platform_admin',
      shopName: '平台岗位',
      contactPhone: '13800000000',
      contactWechat: 'platform-job',
    },
    ...overrides,
  };
}

function buildJobService(
  prisma: Record<string, unknown>,
  community: Record<string, unknown>,
  publication?: PublicationPolicyService,
) {
  return new JobService(
    prisma as never,
    { checkText: jest.fn().mockResolvedValue(undefined) } as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    community as never,
    new JobVisibilityPolicyService(),
    new TutorJobPolicyService(),
    publication,
  );
}

describe('平台岗位发布与报名治理', () => {
  it('平台管理员创建岗位时应写入平台全圈范围并保持待审核', async () => {
    const created = jobFixture();
    const prisma = {
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'merchant_platform',
          status: MerchantStatus.APPROVED,
          contactPhone: '13800000000',
          contactWechat: 'platform-job',
        }),
      },
      community: {
        findUnique: jest.fn().mockResolvedValue({ status: CommunityStatus.ACTIVE }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ openid: 'platform-openid' }),
      },
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({
          adminType: { active: true, deletedAt: null, isPlatform: true },
        }),
      },
      jobPost: {
        create: jest.fn().mockResolvedValue({ id: created.id }),
        findUnique: jest.fn().mockResolvedValue(created),
      },
    };
    const service = buildJobService(
      prisma,
      { assertUserCanParticipate: jest.fn().mockResolvedValue(undefined) },
      new PublicationPolicyService(prisma as never),
    );

    const result = await service.createPost('platform_admin', {
      title: created.title,
      description: created.description,
      salary: created.salary,
      location: created.location,
      locationPoiId: created.locationPoiId,
      locationLng: created.locationLng,
      locationLat: created.locationLat,
      locationCity: created.locationCity,
      category: JobCategory.CATERING,
      settlement: Settlement.DAILY,
      duration: JobDuration.D30,
      communityId: created.communityId,
    });

    expect(prisma.jobPost.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        publisherScope: PublicationScope.PLATFORM,
        visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
        status: JobPostStatus.PENDING,
      }),
    }));
    expect(prisma.jobPost.create.mock.calls[0][0].data.moderationAuthority).toBeUndefined();
    expect(result.platformPublished).toBe(true);
  });

  it('历史平台岗位的原发布者失去平台管理员身份后不得继续维护', async () => {
    const prisma = {
      jobPost: {
        findUnique: jest.fn().mockResolvedValue(jobFixture({
          status: JobPostStatus.PUBLISHED,
        })),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ openid: 'former-admin-openid' }),
      },
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = buildJobService(
      prisma,
      { assertUserCanParticipate: jest.fn().mockResolvedValue(undefined) },
      new PublicationPolicyService(prisma as never),
    );

    await expect(service.takeDownPost('platform_admin', 'job_platform'))
      .rejects.toMatchObject({ bizCode: 10003 });
    expect(prisma.jobPost.update).not.toHaveBeenCalled();
  });

  it('商家不得重新发布被管理员下架的岗位', async () => {
    const update = jest.fn();
    const service = buildJobService({
      jobPost: {
        findUnique: jest.fn().mockResolvedValue(jobFixture({
          status: JobPostStatus.TAKEN_DOWN,
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: JobVisibilityScope.COMMUNITY,
          moderationAuthority: 'COMMUNITY',
        })),
        update,
      },
    }, {
      assertUserCanParticipate: jest.fn().mockResolvedValue(undefined),
    }, {
      assertOwnerCanManage: jest.fn().mockResolvedValue(undefined),
    } as never);

    await expect(service.republishPost('platform_admin', 'job_platform'))
      .rejects.toMatchObject({ bizCode: 40004 });
    expect(update).not.toHaveBeenCalled();
  });
  it('被当前圈子封禁的用户不得报名岗位', async () => {
    const prisma = {
      jobPost: {
        findUnique: jest.fn().mockResolvedValue(jobFixture({
          status: JobPostStatus.PUBLISHED,
          expireAt: null,
        })),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ activeCommunityId: 'community_a' }),
      },
      community: {
        findUnique: jest.fn().mockResolvedValue({ status: CommunityStatus.ACTIVE }),
      },
      communityUserBan: {
        findUnique: jest.fn().mockResolvedValue({ active: true }),
      },
      jobApplication: {
        create: jest.fn(),
      },
    };
    const community = new CommunityService(
      prisma as never,
      {} as never,
      new PublicationPolicyService(prisma as never),
    );
    const service = buildJobService(prisma, community as never);

    await expect(service.apply('banned_user', 'job_platform'))
      .rejects.toMatchObject({ bizCode: 80015 });
    expect(prisma.jobPost.findFirst).not.toHaveBeenCalled();
    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
  });
  it('目标圈子已封禁时不得创建岗位', async () => {
    const assertUserCanParticipate = jest.fn().mockRejectedValue({ bizCode: 80015 });
    const prisma = {
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'merchant_1',
          status: MerchantStatus.APPROVED,
          contactPhone: '13800000000',
          contactWechat: 'merchant',
        }),
      },
      community: {
        findUnique: jest.fn().mockResolvedValue({ status: CommunityStatus.ACTIVE }),
      },
      jobPost: { create: jest.fn() },
    };
    const service = buildJobService(prisma, { assertUserCanParticipate });

    await expect(service.createPost('merchant_user', {
      title: '圈子岗位',
      description: '岗位描述',
      salary: '100元/天',
      location: '学校',
      locationPoiId: 'poi_a',
      locationLng: 116.4,
      locationLat: 39.9,
      locationCity: '北京',
      category: JobCategory.CATERING,
      settlement: Settlement.DAILY,
      duration: JobDuration.D30,
      communityId: 'community_a',
    })).rejects.toMatchObject({ bizCode: 80015 });
    expect(assertUserCanParticipate).toHaveBeenCalledWith('merchant_user', 'community_a');
    expect(prisma.jobPost.create).not.toHaveBeenCalled();
  });

  it('用户切换圈子后仍按岗位原所属圈校验维护权限', async () => {
    const assertUserCanParticipate = jest.fn().mockRejectedValue({ bizCode: 80015 });
    const prisma = {
      jobPost: {
        findUnique: jest.fn().mockResolvedValue(jobFixture({
          merchantId: 'merchant_1',
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: JobVisibilityScope.COMMUNITY,
          status: JobPostStatus.PENDING,
          merchant: { userId: 'merchant_user' },
        })),
        update: jest.fn(),
      },
    };
    const service = buildJobService(prisma, { assertUserCanParticipate });

    await expect(service.updatePost('merchant_user', 'job_platform', { title: '修改标题' }))
      .rejects.toMatchObject({ bizCode: 80015 });
    expect(assertUserCanParticipate).toHaveBeenCalledWith('merchant_user', 'community_a');
    expect(prisma.jobPost.update).not.toHaveBeenCalled();
  });
});


describe('岗位可见性策略', () => {
  it('只生成平台全圈与圈子本圈两种合法发布组合', () => {
    const filters = new JobVisibilityPolicyService().buildFilters('community_a', NOW);
    expect(filters[0]).toEqual({
      OR: [
        {
          publisherScope: PublicationScope.PLATFORM,
          visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
        },
        {
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: JobVisibilityScope.COMMUNITY,
          communityId: 'community_a',
          community: { is: { status: CommunityStatus.ACTIVE } },
        },
      ],
    });
    expect(filters[0]).not.toEqual(expect.objectContaining({
      OR: expect.arrayContaining([
        expect.objectContaining({
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
        }),
      ]),
    }));
  });
});
describe('广场平台内容可见性', () => {
  const platformPost = {
    id: 'post_platform',
    circleId: 'community_origin',
    authorId: 'platform_admin',
    content: '平台公告',
    images: [],
    tags: [],
    isAnonymous: false,
    anonName: null,
    videoUrl: null,
    videoCover: null,
    likeCount: 2,
    viewCount: 10,
    publisherScope: PublicationScope.PLATFORM,
    visibility: PostVisibility.PUBLIC,
    pinned: false,
    featured: false,
    boostUntil: null,
    publishAt: NOW,
    createdAt: NOW,
    editedAt: null,
    author: { nickname: '平台管理员', avatarUrl: null },
    _count: { comments: 1 },
    postLikes: [],
  };
  const platformAnonPost = {
    id: 'anon_platform',
    anonId: 'anon_platform_author',
    content: '平台树洞内容',
    images: [],
    mood: null,
    likeCount: 3,
    viewCount: 11,
    publisherScope: PublicationScope.PLATFORM,
    boostUntil: null,
    createdAt: new Date('2026-09-04T07:00:00.000Z'),
    _count: { comments: 2 },
  };

  it('双源混合流应允许平台全圈内容、限制圈子内容到当前圈，并映射平台标识', async () => {
    const prisma = {
      post: {
        findMany: jest.fn()
          .mockResolvedValueOnce([platformPost])
          .mockResolvedValueOnce([]),
      },
      anonymousPost: {
        findMany: jest.fn()
          .mockResolvedValueOnce([platformAnonPost])
          .mockResolvedValueOnce([]),
      },
      jobPost: { findMany: jest.fn() },
    };
    const publication = new PublicationPolicyService(prisma as never);
    const service = new SquareService(
      prisma as never,
      {} as never,
      { resolveFeedCommunityId: jest.fn().mockResolvedValue('community_current') } as never,
      publication,
    );

    const result = await service.feed('viewer', null, { limit: 10, sort: 'latest' });

    const expectedContentVisibility = {
      OR: [
        {
          publisherScope: PublicationScope.PLATFORM,
          visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
        },
        {
          publisherScope: PublicationScope.COMMUNITY,
          visibilityScope: ContentVisibilityScope.COMMUNITY,
          communityId: 'community_current',
          community: { is: { status: CommunityStatus.ACTIVE } },
        },
      ],
    };
    expect(prisma.post.findMany.mock.calls[0][0].where.AND[0]).toEqual(expectedContentVisibility);
    expect(prisma.anonymousPost.findMany.mock.calls[0][0].where.AND[0]).toEqual(expectedContentVisibility);
    expect(prisma.jobPost.findMany).not.toHaveBeenCalled();
    expect(result.list).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'post', data: expect.objectContaining({ platformPublished: true }) }),
      expect.objectContaining({ kind: 'anon_post', data: expect.objectContaining({ platformPublished: true }) }),
    ]));
  });

  it('今日上头仅展示表白墙和树洞，并忽略历史岗位热度记录', async () => {
    const prisma = {
      post: { findMany: jest.fn() },
      anonymousPost: { findMany: jest.fn() },
      jobPost: { findMany: jest.fn() },
    };
    const service = new SquareService(
      prisma as never,
      {} as never,
      {
        resolveFeedCommunityId: jest.fn().mockResolvedValue('community_current'),
        getTodayHot: jest.fn().mockResolvedValue([
          { targetType: 'job_post', targetId: 'job_hot', viewCount: 21 },
        ]),
      } as never,
      new PublicationPolicyService(prisma as never),
    );

    await expect(service.todayHit('viewer', null, { limit: 10 })).resolves.toEqual({ list: [] });
    expect(prisma.jobPost.findMany).not.toHaveBeenCalled();
  });
});

describe('圈子批量动态统计', () => {
  it('应把平台内容计入每个活跃圈子且保持固定聚合查询数', async () => {
    const communities = [
      {
        id: 'community_a',
        name: '圈子 A',
        logo: null,
        backgroundImage: null,
        description: null,
        category: '校园',
        region: '北京',
        location: '学校 A',
        memberCount: 0,
        postCount: 0,
        status: CommunityStatus.ACTIVE,
        rejectReason: null,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
      },
      {
        id: 'community_b',
        name: '圈子 B',
        logo: null,
        backgroundImage: null,
        description: null,
        category: '校园',
        region: '上海',
        location: '学校 B',
        memberCount: 0,
        postCount: 0,
        status: CommunityStatus.ACTIVE,
        rejectReason: null,
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
      },
    ];
    const prisma = {
      community: {
        findMany: jest.fn().mockResolvedValue(communities),
      },
      communityMember: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { communityId: 'community_a', _count: { _all: 1 } },
          { communityId: 'community_b', _count: { _all: 2 } },
        ]),
      },
      post: {
        groupBy: jest.fn().mockResolvedValue([
          {
            communityId: 'community_a',
            publisherScope: PublicationScope.COMMUNITY,
            visibilityScope: ContentVisibilityScope.COMMUNITY,
            _count: { _all: 2 },
          },
          {
            communityId: 'community_a',
            publisherScope: PublicationScope.PLATFORM,
            visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
            _count: { _all: 5 },
          },
        ]),
      },
      anonymousPost: {
        groupBy: jest.fn().mockResolvedValue([
          {
            communityId: 'community_b',
            publisherScope: PublicationScope.COMMUNITY,
            visibilityScope: ContentVisibilityScope.COMMUNITY,
            _count: { _all: 3 },
          },
          {
            communityId: 'community_a',
            publisherScope: PublicationScope.PLATFORM,
            visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
            _count: { _all: 7 },
          },
        ]),
      },
      jobPost: {
        groupBy: jest.fn().mockResolvedValue([
          { communityId: 'community_a', _count: { _all: 11 } },
        ]),
        count: jest.fn().mockResolvedValue(13),
      },
    };
    const service = new CommunityService(
      prisma as never,
      {} as never,
      new PublicationPolicyService(prisma as never),
    );

    const result = await service.listPublic('viewer');

    expect(result).toEqual([
      expect.objectContaining({ id: 'community_b', memberCount: 2, postCount: 15 }),
      expect.objectContaining({ id: 'community_a', memberCount: 1, postCount: 14 }),
    ]);
    expect(prisma.communityMember.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.post.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.anonymousPost.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.jobPost.groupBy).not.toHaveBeenCalled();
    expect(prisma.jobPost.count).not.toHaveBeenCalled();
  });
});
