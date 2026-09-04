import {
  ContentVisibilityScope,
  ModerationAuthority,
  PublicationScope,
} from '@prisma/client';
import { TreeholeService } from '../../src/modules/treehole/treehole.service';

const now = new Date('2026-09-04T08:00:00.000Z');

function anonPostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'anon_post_1',
    communityId: 'community_a',
    anonId: 'anon_1',
    content: '平台树洞公告',
    images: [],
    mood: null,
    status: 'APPROVED',
    createdAt: now,
    likeCount: 0,
    publisherScope: PublicationScope.PLATFORM,
    visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
    moderationAuthority: ModerationAuthority.PLATFORM,
    moderationVersion: 0,
    viewCount: 0,
    boostUntil: null,
    likes: [],
    _count: { comments: 0 },
    ...overrides,
  };
}

function buildService(interactionError?: Error, transactionError?: Error) {
  const create = jest.fn().mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(anonPostRow(args.data)),
  );
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    anonymousProfile: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user_1' }),
    },
    anonymousPost: { create, findMany },
    anonBlock: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (tx: { anonymousPost: { create: typeof create } }) => unknown) => (
      callback({ anonymousPost: { create } })
    )),
  };
  const moderation = {
    checkText: jest.fn().mockResolvedValue(undefined),
    checkImage: jest.fn().mockResolvedValue(undefined),
  };
  const community = {
    getActiveCommunityId: jest.fn().mockResolvedValue('community_a'),
    resolveFeedCommunityId: jest.fn().mockResolvedValue('community_a'),
  };
  const visibilityFilter = {
    OR: [
      {
        publisherScope: PublicationScope.PLATFORM,
        visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
      },
      {
        publisherScope: PublicationScope.COMMUNITY,
        visibilityScope: ContentVisibilityScope.COMMUNITY,
        communityId: 'community_a',
      },
    ],
  };
  const publicationPolicy = {
    resolveForAnon: jest.fn().mockResolvedValue(PublicationScope.PLATFORM),
    assertAnonCommunityInteractionAllowed: interactionError
      ? jest.fn().mockRejectedValue(interactionError)
      : jest.fn().mockResolvedValue(undefined),
    assertOwnerCanManageInTransaction: jest.fn().mockResolvedValue(undefined),
    assertCommunityInteractionAllowedInTransaction: transactionError
      ? jest.fn().mockRejectedValue(transactionError)
      : jest.fn().mockResolvedValue(undefined),
    anonymousPostVisibilityFilter: jest.fn().mockReturnValue(visibilityFilter),
  };

  const service = new TreeholeService(
    prisma as never,
    {} as never,
    moderation as never,
    {} as never,
    {} as never,
    community as never,
    publicationPolicy as never,
  );
  return {
    service,
    create,
    findMany,
    moderation,
    publicationPolicy,
    visibilityFilter,
  };
}

describe('TreeholeService 平台发布治理', () => {
  it('平台匿名身份发帖应写入平台上下文且响应不泄露真实身份', async () => {
    const { service, create } = buildService();

    const result = await service.createPost('anon_1', {
      content: '平台树洞公告',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherScope: PublicationScope.PLATFORM,
          visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
        }),
      }),
    );
    expect(result.platformPublished).toBe(true);
    expect(result).not.toHaveProperty('uid');
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('openid');
    expect(result).not.toHaveProperty('adminId');
  });

  it('树洞列表应同时使用当前圈和全圈平台内容过滤条件', async () => {
    const { service, findMany, visibilityFilter } = buildService();

    await service.listPosts('anon_1');

    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [args] of findMany.mock.calls as Array<[{ where: { AND?: unknown[] } }]>) {
      expect(JSON.stringify(args.where)).toContain(JSON.stringify(visibilityFilter));
    }
  });

  it('最新列表应使用 createdAt + id 复合游标避免同时间戳漏项', async () => {
    const { service, findMany } = buildService();
    findMany
      .mockResolvedValueOnce([
        anonPostRow({ id: 'same_time_b' }),
        anonPostRow({ id: 'same_time_a' }),
      ])
      .mockResolvedValueOnce([]);

    const firstPage = await service.listPosts('anon_1', { limit: 1 });

    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPage.nextCursor).not.toBe(now.toISOString());
    findMany.mockReset().mockResolvedValue([]);

    await service.listPosts('anon_1', { limit: 1, cursor: firstPage.nextCursor! });

    const latestQuery = findMany.mock.calls[0]?.[0] as {
      where: unknown;
      orderBy: unknown;
    };
    expect(latestQuery.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(JSON.stringify(latestQuery.where)).toContain('"id":{"lt":"same_time_b"}');
  });

  it('圈子封禁应在内容安全检查和写库前拦截树洞发帖', async () => {
    const denied = new Error('community banned');
    const { service, create, moderation } = buildService(denied);

    await expect(
      service.createPost('anon_1', { content: '不应写入' }),
    ).rejects.toBe(denied);

    expect(moderation.checkText).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('事务内资格失效时不得提交树洞帖子', async () => {
    const denied = new Error('community banned during moderation');
    const { service, create, publicationPolicy } = buildService(undefined, denied);

    await expect(
      service.createPost('anon_1', { content: '不应写入' }),
    ).rejects.toBe(denied);

    expect(publicationPolicy.assertOwnerCanManageInTransaction).toHaveBeenCalled();
    expect(publicationPolicy.assertCommunityInteractionAllowedInTransaction).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});