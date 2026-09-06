import { HttpStatus } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { BizException } from '../src/common/exceptions/biz.exception';
import { ConfessionService } from '../src/modules/confession/confession.service';
import { FollowService } from '../src/modules/follow/follow.service';
import { TreeholeService } from '../src/modules/treehole/treehole.service';

describe('用户主页与匿名关注', () => {
  it('匿名作者主页返回关注状态和匿名关系计数，且不泄露真实身份', async () => {
    const service = Object.create(TreeholeService.prototype) as TreeholeService;
    const subject = service as any;
    const profileFindUnique = jest.fn().mockResolvedValue({
      nickname: '月光信箱',
      avatar: 'moon',
      personalityTags: ['慢热'],
      interestTags: ['音乐'],
      moodState: '平静',
    });
    subject.prisma = {
      anonymousProfile: { findUnique: profileFindUnique },
      anonymousPost: { count: jest.fn().mockResolvedValue(2) },
      anonBlock: { findFirst: jest.fn().mockResolvedValue(null) },
      anonFollow: {
        findUnique: jest.fn().mockResolvedValue({ id: 'follow-1' }),
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(4),
      },
    };
    subject.community = { resolveFeedCommunityId: jest.fn().mockResolvedValue('community-1') };
    subject.publicationPolicy = {
      anonymousPostVisibilityFilter: jest.fn().mockReturnValue({ communityId: 'community-1' }),
    };

    const result = await service.getAuthor('anon-viewer', 'anon-author');

    expect(result).toMatchObject({
      anonId: 'anon-author',
      following: true,
      followerCount: 3,
      followingCount: 4,
      postCount: 2,
    });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('uid');
    expect(result).not.toHaveProperty('openid');
    const publicProfileQuery = profileFindUnique.mock.calls.find(
      ([args]) => args?.select?.nickname,
    );
    expect(publicProfileQuery?.[0]?.select).not.toHaveProperty('userId');
  });

  it('匿名关注支持关注和取关，并返回最新粉丝数', async () => {
    const createService = (existing: { id: string } | null) => {
      const service = Object.create(TreeholeService.prototype) as TreeholeService;
      const subject = service as any;
      const create = jest.fn().mockResolvedValue({ id: 'follow-new' });
      const remove = jest.fn().mockResolvedValue({ id: existing?.id });
      subject.prisma = {
        anonymousProfile: {
          findUnique: jest.fn().mockResolvedValue({
            nickname: '月光信箱',
            avatar: null,
            personalityTags: [],
            interestTags: [],
            moodState: null,
          }),
        },
        anonBlock: { findFirst: jest.fn().mockResolvedValue(null) },
        anonFollow: {
          findUnique: jest.fn().mockResolvedValue(existing),
          create,
          delete: remove,
          count: jest.fn().mockResolvedValue(existing ? 1 : 2),
        },
      };
      return { service, create, remove };
    };

    const added = createService(null);
    await expect(added.service.toggleAnonFollow('anon-viewer', 'anon-author'))
      .resolves.toEqual({ following: true, followerCount: 2 });
    expect(added.create).toHaveBeenCalledWith({
      data: { followerAnonId: 'anon-viewer', followeeAnonId: 'anon-author' },
    });

    const removed = createService({ id: 'follow-old' });
    await expect(removed.service.toggleAnonFollow('anon-viewer', 'anon-author'))
      .resolves.toEqual({ following: false, followerCount: 1 });
    expect(removed.remove).toHaveBeenCalledWith({ where: { id: 'follow-old' } });
  });

  it('匿名身份不能关注自己，存在屏蔽关系时也不能关注', async () => {
    const service = Object.create(TreeholeService.prototype) as TreeholeService;
    const subject = service as any;
    subject.prisma = {
      anonymousProfile: { findUnique: jest.fn().mockResolvedValue({ nickname: '匿名用户' }) },
      anonBlock: { findFirst: jest.fn().mockResolvedValue({ id: 'blocked' }) },
      anonFollow: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn() },
    };

    await expect(service.toggleAnonFollow('anon-self', 'anon-self')).rejects.toMatchObject({
      bizCode: 30004,
    });
    await expect(service.toggleAnonFollow('anon-viewer', 'anon-author')).rejects.toMatchObject({
      bizCode: 30005,
    });
    expect(subject.prisma.anonFollow.create).not.toHaveBeenCalled();
  });

  it('实名主页返回公开资料、关注状态和当前圈公开动态', async () => {
    const service = Object.create(FollowService.prototype) as FollowService;
    const subject = service as any;
    subject.prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-target',
          nickname: '小桐',
          avatarUrl: 'https://example.test/avatar.png',
        }),
      },
      follow: {
        findUnique: jest.fn().mockResolvedValue({ id: 'follow-1' }),
        count: jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(5),
      },
    };
    subject.confession = {
      listPublicAuthorPosts: jest.fn().mockResolvedValue({
        list: [{ id: 'post-1' }], total: 1, page: 1, pageSize: 20,
      }),
    };

    const result = await service.getProfile('user-viewer', 'user-target', 1, 20);

    expect(result).toMatchObject({
      userId: 'user-target',
      nickname: '小桐',
      isSelf: false,
      following: true,
      followerCount: 8,
      followingCount: 5,
      postCount: 1,
    });
    expect(subject.confession.listPublicAuthorPosts)
      .toHaveBeenCalledWith('user-viewer', 'user-target', 1, 20);
  });

  it('实名主页目标不存在时返回 404', async () => {
    const service = Object.create(FollowService.prototype) as FollowService;
    const subject = service as any;
    subject.prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    subject.confession = { listPublicAuthorPosts: jest.fn() };

    let caught: unknown;
    try {
      await service.getProfile('user-viewer', 'missing-user', 1, 20);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BizException);
    expect((caught as BizException).bizCode).toBe(10001);
    expect((caught as BizException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('实名主页动态严格过滤匿名、非公开、未审核及跨圈普通内容', async () => {
    const service = Object.create(ConfessionService.prototype) as ConfessionService;
    const subject = service as any;
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const visibilityFilter = {
      OR: [{ communityId: 'community-1' }, { visibilityScope: 'ALL_COMMUNITIES' }],
    };
    subject.prisma = { post: { findMany, count } };
    subject.community = { resolveFeedCommunityId: jest.fn().mockResolvedValue('community-1') };
    subject.publicationPolicy = { postVisibilityFilter: jest.fn().mockReturnValue(visibilityFilter) };

    await service.listPublicAuthorPosts('user-viewer', 'user-target', 1, 20);

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      authorId: 'user-target',
      isAnonymous: false,
      status: PostStatus.APPROVED,
      visibility: 'PUBLIC',
      deletedAt: null,
      AND: [visibilityFilter],
    });
    expect(count).toHaveBeenCalledWith({ where });
  });
});
