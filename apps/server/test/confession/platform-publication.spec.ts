import {
  ContentVisibilityScope,
  ModerationAuthority,
  PublicationScope,
} from '@prisma/client';
import { ConfessionService } from '../../src/modules/confession/confession.service';

const now = new Date('2026-09-04T08:00:00.000Z');

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post_1',
    circleId: 'circle_1',
    communityId: 'community_a',
    authorId: 'user_1',
    content: '平台公告',
    images: [],
    tags: [],
    isAnonymous: false,
    anonName: null,
    videoUrl: null,
    videoCover: null,
    likeCount: 0,
    viewCount: 0,
    status: 'APPROVED',
    publisherScope: PublicationScope.PLATFORM,
    visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
    moderationAuthority: ModerationAuthority.PLATFORM,
    moderationVersion: 0,
    visibility: 'PUBLIC',
    pinned: false,
    featured: false,
    boostUntil: null,
    topicId: null,
    publishAt: null,
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    author: { id: 'user_1', nickname: '平台管理员', avatarUrl: null },
    _count: { comments: 0 },
    postLikes: [],
    ...overrides,
  };
}

function buildService(options: {
  manageError?: Error;
  interactionError?: Error;
  transactionManageError?: Error;
  transactionInteractionError?: Error;
  duePosts?: Array<Record<string, unknown>>;
} = {}) {
  const create = jest.fn().mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(postRow(args.data)),
  );
  const findMany = jest.fn().mockResolvedValue(options.duePosts ?? []);
  const update = jest.fn().mockResolvedValue(postRow());
  const scheduledUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    circle: { findUnique: jest.fn().mockResolvedValue({ id: 'circle_1' }) },
    post: {
      create,
      findMany,
      findFirst: jest.fn().mockResolvedValue(
        postRow({ authorId: 'user_1' }),
      ),
      update,
    },
    community: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(
      (callback: (tx: unknown) => unknown) => callback({
        post: { create, updateMany: scheduledUpdateMany },
        community: { update: jest.fn().mockResolvedValue({}) },
      }),
    ),
  };
  const moderation = {
    checkText: jest.fn().mockResolvedValue(undefined),
    checkImage: jest.fn().mockResolvedValue(undefined),
    checkVideoStub: jest.fn(),
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
  const transactionManageError = options.transactionManageError ?? options.manageError;
  const transactionInteractionError = options.transactionInteractionError ?? options.interactionError;
  const publicationPolicy = {
    resolveForUser: jest.fn().mockResolvedValue(PublicationScope.PLATFORM),
    assertCommunityInteractionAllowed: options.interactionError
      ? jest.fn().mockRejectedValue(options.interactionError)
      : jest.fn().mockResolvedValue(undefined),
    assertOwnerCanManage: options.manageError
      ? jest.fn().mockRejectedValue(options.manageError)
      : jest.fn().mockResolvedValue(undefined),
    assertOwnerCanManageInTransaction: transactionManageError
      ? jest.fn().mockRejectedValue(transactionManageError)
      : jest.fn().mockResolvedValue(undefined),
    assertCommunityInteractionAllowedInTransaction: transactionInteractionError
      ? jest.fn().mockRejectedValue(transactionInteractionError)
      : jest.fn().mockResolvedValue(undefined),
    postVisibilityFilter: jest.fn().mockReturnValue(visibilityFilter),
  };

  const service = new ConfessionService(
    prisma as never,
    moderation as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    community as never,
    publicationPolicy as never,
  );
  return {
    service,
    create,
    findMany,
    update,
    scheduledUpdateMany,
    moderation,
    publicationPolicy,
    visibilityFilter,
  };
}

describe('ConfessionService 平台发布治理', () => {
  it('平台管理员发帖应由服务端写入平台发布上下文并返回平台标记', async () => {
    const { service, create, publicationPolicy } = buildService();

    const result = await service.createPost(
      'user_1',
      'openid_1',
      'circle_1',
      { content: '平台公告' },
    );

    expect(publicationPolicy.assertCommunityInteractionAllowed).toHaveBeenCalledWith(
      'user_1',
      'community_a',
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publisherScope: PublicationScope.PLATFORM,
          visibilityScope: ContentVisibilityScope.ALL_COMMUNITIES,
        }),
      }),
    );
    expect(result.platformPublished).toBe(true);
  });

  it('圈子帖子列表应同时使用当前圈和全圈平台内容过滤条件', async () => {
    const { service, findMany, visibilityFilter } = buildService();

    await service.listCirclePosts('user_1', 'circle_1', {});

    expect(findMany).toHaveBeenCalledTimes(3);
    for (const [args] of findMany.mock.calls as Array<[{ where: { AND?: unknown[] } }]>) {
      expect(args.where.AND).toContainEqual(visibilityFilter);
    }
  });

  it('历史平台内容编辑前应校验作者当前仍具平台管理员身份', async () => {
    const denied = new Error('not platform admin');
    const { service, update, moderation, publicationPolicy } = buildService({
      manageError: denied,
    });

    await expect(
      service.editPost('user_1', 'post_1', 'openid_1', {
        content: '修改后的公告',
      }),
    ).rejects.toBe(denied);

    expect(publicationPolicy.assertOwnerCanManage).toHaveBeenCalledWith(
      'user_1',
      PublicationScope.PLATFORM,
    );
    expect(moderation.checkText).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('圈子封禁应在内容安全检查和写库前拦截表白墙发帖', async () => {
    const denied = new Error('community banned');
    const { service, create, moderation } = buildService({
      interactionError: denied,
    });

    await expect(
      service.createPost('user_1', 'openid_1', 'circle_1', {
        content: '不应写入',
      }),
    ).rejects.toBe(denied);

    expect(moderation.checkText).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it('内容审核后发生圈子封禁时应在写事务内终止发布', async () => {
    const denied = new Error('community banned during moderation');
    const { service, create, moderation, publicationPolicy } = buildService({
      transactionInteractionError: denied,
    });

    await expect(
      service.createPost('user_1', 'openid_1', 'circle_1', { content: '不应写入' }),
    ).rejects.toBe(denied);

    expect(moderation.checkText).toHaveBeenCalled();
    expect(publicationPolicy.assertOwnerCanManageInTransaction).toHaveBeenCalled();
    expect(publicationPolicy.assertCommunityInteractionAllowedInTransaction).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('定时平台帖到期前若作者失去平台身份应终止发布', async () => {
    const denied = new Error('platform role revoked');
    const duePost = postRow({ visibility: 'DRAFT', publishAt: now });
    const { service, update, moderation, publicationPolicy, scheduledUpdateMany } = buildService({
      manageError: denied,
      duePosts: [duePost],
    });

    await expect(service.publishScheduledPosts()).resolves.toEqual({ published: 0, failed: 1 });

    expect(moderation.checkText).toHaveBeenCalledWith('平台公告');
    expect(publicationPolicy.assertOwnerCanManageInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      PublicationScope.PLATFORM,
    );
    expect(scheduledUpdateMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'post_1' },
      data: { publishAt: null },
    });
  });

  it('定时帖排期后被圈子封禁时应在事务内终止发布', async () => {
    const denied = new Error('community banned');
    const duePost = postRow({ visibility: 'DRAFT', publishAt: now });
    const { service, update, publicationPolicy, scheduledUpdateMany } = buildService({
      interactionError: denied,
      duePosts: [duePost],
    });

    await expect(service.publishScheduledPosts()).resolves.toEqual({ published: 0, failed: 1 });

    expect(publicationPolicy.assertCommunityInteractionAllowedInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      'community_a',
    );
    expect(scheduledUpdateMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'post_1' },
      data: { publishAt: null },
    });
  });

  it('定时帖仅在事务内资格复核通过且仍为原排期状态时发布', async () => {
    const duePost = postRow({ visibility: 'DRAFT', publishAt: now });
    const { service, publicationPolicy, scheduledUpdateMany } = buildService({
      duePosts: [duePost],
    });

    await expect(service.publishScheduledPosts()).resolves.toEqual({ published: 1, failed: 0 });

    expect(publicationPolicy.assertOwnerCanManageInTransaction).toHaveBeenCalled();
    expect(publicationPolicy.assertCommunityInteractionAllowedInTransaction).toHaveBeenCalled();
    expect(scheduledUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'post_1',
        visibility: 'DRAFT',
        publishAt: now,
      },
      data: { visibility: 'PUBLIC', publishAt: null },
    });
  });
});
