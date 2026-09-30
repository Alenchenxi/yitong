import { HttpStatus } from '@nestjs/common';
import { JobPostStatus, ModerationAuthority, ModerationStatus, PayStatus, PostStatus, PublicationScope } from '@prisma/client';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { AdminController } from '../../src/modules/admin/admin.controller';
import { ADMIN_ALLOW_ANY_KEY } from '../../src/modules/admin/admin-access.decorator';
import {
  AdminAccessService,
  type AdminAccessContext,
} from '../../src/modules/admin/admin-access.service';
import { AdminService } from '../../src/modules/admin/admin.service';

const circleAccess: AdminAccessContext = {
  adminId: 'admin_circle',
  openid: 'openid_circle',
  adminTypeId: 'type_circle',
  adminTypeName: '圈子管理员',
  isPlatform: false,
  allCommunities: false,
  communityIds: ['community_a'],
  permissions: [],
};

const platformAccess: AdminAccessContext = {
  ...circleAccess,
  adminId: 'admin_platform',
  isPlatform: true,
  allCommunities: true,
  communityIds: [],
};

function createService(prisma: Record<string, unknown>, accessService: Record<string, unknown>) {
  const prismaWithTransaction = prisma as Record<string, unknown> & {
    $transaction?: (callback: (tx: Record<string, unknown>) => unknown) => unknown;
  };
  prismaWithTransaction.$transaction ??= jest.fn(
    (callback: (tx: Record<string, unknown>) => unknown) => callback(prismaWithTransaction),
  );
  return new AdminService(
    prismaWithTransaction as never,
    { invalidateFeedCache: jest.fn() } as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    accessService as never,
  );
}

describe('moderation context route policy', () => {
  it('allows any authenticated administrator because contexts are access-scoped', () => {
    expect(Reflect.getMetadata(ADMIN_ALLOW_ANY_KEY, AdminController.prototype.getModerationContexts)).toBe(true);
  });
});

describe('platform content governance access', () => {
  const access = new AdminAccessService({} as never);

  it('rejects platform context, unsupported scope, and platform content for a circle administrator', async () => {
    await expect(access.assertModerationContext(circleAccess, 'PLATFORM')).rejects.toMatchObject({ bizCode: 10003 });
    await expect(access.assertModerationContext(circleAccess, 'INVALID' as never)).rejects.toMatchObject({ bizCode: 10004 });
    await expect(
      access.assertModerationTarget(circleAccess, PublicationScope.PLATFORM, 'community_a'),
    ).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('returns community authority for an authorized circle administrator and platform authority for platform administrators', async () => {
    await expect(
      access.assertModerationTarget(circleAccess, PublicationScope.COMMUNITY, 'community_a'),
    ).resolves.toBe(ModerationAuthority.COMMUNITY);
    await expect(
      access.assertModerationTarget(platformAccess, PublicationScope.COMMUNITY, 'community_a'),
    ).resolves.toBe(ModerationAuthority.PLATFORM);
  });
});

describe('platform content governance restore and bans', () => {
  const communityPost = {
    id: 'post_1',
    publisherScope: PublicationScope.COMMUNITY,
    communityId: 'community_a',
    moderationAuthority: ModerationAuthority.COMMUNITY,
  };

  it('returns a 409 business conflict for a stale post restore version', async () => {
    const service = createService({
      post: {
        findUnique: jest.fn().mockResolvedValue(communityPost),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      moderationRecord: { create: jest.fn() },
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restorePost('post_1', 3, 'admin_circle', circleAccess)).rejects.toMatchObject({
      bizCode: 40004,
    });
  });

  it('does not let a circle administrator restore platform-moderated content', async () => {
    const service = createService({
      post: {
        findUnique: jest.fn().mockResolvedValue({
          ...communityPost,
          moderationAuthority: ModerationAuthority.PLATFORM,
        }),
        updateMany: jest.fn(),
      },
      moderationRecord: { create: jest.fn() },
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restorePost('post_1', 1, 'admin_circle', circleAccess)).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('allows an authorized circle administrator to restore circle-moderated content', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const moderationRecord = { create: jest.fn().mockResolvedValue(undefined) };
    const service = createService({
      post: { findUnique: jest.fn().mockResolvedValue(communityPost), updateMany },
      moderationRecord,
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restorePost('post_1', 1, 'admin_circle', circleAccess)).resolves.toEqual({
      id: 'post_1',
      status: PostStatus.APPROVED,
      moderationVersion: 2,
    });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'post_1', status: PostStatus.REJECTED, moderationAuthority: ModerationAuthority.COMMUNITY, moderationVersion: 1 },
    }));
    expect(moderationRecord.create).toHaveBeenCalled();
  });

  it('does not let a circle administrator pin, feature, or comment-pin platform content', async () => {
    const denied = jest.fn().mockRejectedValue(new BizException(10003, 'forbidden', HttpStatus.FORBIDDEN));
    const service = createService({
      post: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post_platform',
          publisherScope: PublicationScope.PLATFORM,
          communityId: 'community_a',
        }),
        update: jest.fn(),
      },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_platform',
          publisherScope: PublicationScope.PLATFORM,
          communityId: 'community_a',
          status: 'PUBLISHED',
        }),
        update: jest.fn(),
      },
      comment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'comment_1',
          post: { publisherScope: PublicationScope.PLATFORM, communityId: 'community_a' },
        }),
        update: jest.fn(),
      },
      moderationRecord: { create: jest.fn() },
    }, { assertModerationTarget: denied });

    await expect(service.pinPost('post_platform', 'admin_circle', true, undefined, circleAccess)).rejects.toMatchObject({ bizCode: 10003 });
    await expect(service.featurePost('post_platform', 'admin_circle', true, undefined, circleAccess)).rejects.toMatchObject({ bizCode: 10003 });
    await expect(service.featureJob('job_platform', 'admin_circle', true, circleAccess)).rejects.toMatchObject({ bizCode: 10003 });
    await expect(service.pinComment('comment_1', 'admin_circle', true, circleAccess)).rejects.toMatchObject({ bizCode: 10003 });
    expect(denied).toHaveBeenCalledTimes(4);
  });

  it('does not let a circle administrator ban a platform administrator', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_platform', openid: 'openid_platform' }) },
      adminUser: { findUnique: jest.fn().mockResolvedValue({ adminType: { isPlatform: true } }) },
      communityUserBan: { upsert: jest.fn() },
    }, {
      assertModerationContext: jest.fn().mockResolvedValue('COMMUNITY'),
    });

    await expect(
      service.banUser('user_platform', 'COMMUNITY', 'community_a', undefined, 'admin_circle', circleAccess),
    ).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('does not let a circle administrator lift a platform-issued community ban', async () => {
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1' }) },
      communityUserBan: {
        findUnique: jest.fn().mockResolvedValue({ authority: ModerationAuthority.PLATFORM, active: true }),
        update: jest.fn(),
      },
    }, {
      assertModerationContext: jest.fn().mockResolvedValue('COMMUNITY'),
    });

    await expect(
      service.unbanUser('user_1', 'COMMUNITY', 'community_a', 'admin_circle', circleAccess),
    ).rejects.toMatchObject({ bizCode: 10003 });
  });

  it('rejects circle-admin attempts to overwrite platform takedowns for all content kinds', async () => {
    const accessService = {
      assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY),
    };
    const postService = createService({
      post: {
        findUnique: jest.fn().mockResolvedValue({
          ...communityPost,
          status: PostStatus.REJECTED,
          moderationVersion: 2,
          moderationAuthority: ModerationAuthority.PLATFORM,
          authorId: 'author_1',
        }),
      },
    }, accessService);
    const anonService = createService({
      anonymousPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'anon_1',
          publisherScope: PublicationScope.COMMUNITY,
          communityId: 'community_a',
          status: PostStatus.REJECTED,
          moderationVersion: 2,
          moderationAuthority: ModerationAuthority.PLATFORM,
        }),
      },
    }, accessService);
    const jobService = createService({
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          publisherScope: PublicationScope.COMMUNITY,
          communityId: 'community_a',
          status: JobPostStatus.TAKEN_DOWN,
          moderationVersion: 2,
          moderationAuthority: ModerationAuthority.PLATFORM,
          merchant: { userId: 'merchant_1' },
        }),
      },
    }, accessService);

    await expect(postService.takedownPost('post_1', 'admin_circle', undefined, circleAccess))
      .rejects.toMatchObject({ bizCode: 10003 });
    await expect(anonService.takedownAnonPost('anon_1', 'admin_circle', undefined, circleAccess))
      .rejects.toMatchObject({ bizCode: 10003 });
    await expect(jobService.takedownJobPost('job_1', 'admin_circle', undefined, circleAccess))
      .rejects.toMatchObject({ bizCode: 10003 });
  });

  it('does not let a circle administrator downgrade an active platform community ban', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', openid: 'openid_user' }) },
      adminUser: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'user_1' }]),
      communityUserBan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ban_1',
          active: true,
          authority: ModerationAuthority.PLATFORM,
        }),
        updateMany,
      },
    }, {
      assertModerationContext: jest.fn().mockResolvedValue('COMMUNITY'),
    });

    await expect(
      service.banUser('user_1', 'COMMUNITY', 'community_a', undefined, 'admin_circle', circleAccess),
    ).rejects.toMatchObject({ bizCode: 10003 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'ban_1',
        OR: [{ active: false }, { authority: ModerationAuthority.COMMUNITY }],
      }),
    }));
  });

  it('serializes the first community ban by locking the target user before create', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ id: 'user_1' }]);
    const create = jest.fn().mockResolvedValue({ id: 'ban_1' });
    const service = createService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', openid: 'openid_user' }) },
      adminUser: { findUnique: jest.fn().mockResolvedValue(null) },
      $queryRawUnsafe: queryRaw,
      communityUserBan: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    }, {
      assertModerationContext: jest.fn().mockResolvedValue('COMMUNITY'),
    });

    await expect(
      service.banUser('user_1', 'COMMUNITY', 'community_a', '违规', 'admin_platform', platformAccess),
    ).resolves.toMatchObject({ banned: true });

    expect(queryRaw).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), 'user_1');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('does not restore a job that was taken down outside administrator governance', async () => {
    const paymentLookup = jest.fn();
    const service = createService({
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          publisherScope: PublicationScope.COMMUNITY,
          communityId: 'community_a',
          status: JobPostStatus.TAKEN_DOWN,
          moderationAuthority: null,
          moderationVersion: 1,
        }),
      },
      paymentOrder: { findFirst: paymentLookup },
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restoreJobPost('job_1', 1, 'admin_circle', circleAccess))
      .rejects.toMatchObject({ bizCode: 40004 });
    expect(paymentLookup).not.toHaveBeenCalled();
  });

  it('requires a paid publish order before restoring an administrator-taken-down job', async () => {
    const service = createService({
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          publisherScope: PublicationScope.COMMUNITY,
          communityId: 'community_a',
          status: JobPostStatus.TAKEN_DOWN,
          moderationAuthority: ModerationAuthority.COMMUNITY,
          moderationVersion: 1,
        }),
      },
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([{ id: 'job_1' }])
        .mockResolvedValueOnce([]),
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restoreJobPost('job_1', 1, 'admin_circle', circleAccess))
      .rejects.toMatchObject({ bizCode: 40004 });
  });

  it('rejects restore when an older order was paid but the latest publish order was refunded', async () => {
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([{ id: 'job_1' }])
      .mockResolvedValueOnce([{ id: 'order_refunded', status: PayStatus.REFUNDED }]);
    const service = createService({
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          publisherScope: PublicationScope.COMMUNITY,
          communityId: 'community_a',
          status: JobPostStatus.TAKEN_DOWN,
          moderationAuthority: ModerationAuthority.COMMUNITY,
          moderationVersion: 2,
        }),
      },
      $queryRawUnsafe: queryRaw,
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restoreJobPost('job_1', 2, 'admin_circle', circleAccess))
      .rejects.toMatchObject({ bizCode: 40004 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls[0]?.[0]).toContain('FROM "job_posts"');
    expect(queryRaw.mock.calls[0]?.[0]).toContain('FOR UPDATE');
    expect(queryRaw.mock.calls[1]?.[0]).toContain('ORDER BY "created_at" DESC, "id" DESC');
    expect(queryRaw.mock.calls[1]?.[0]).toContain('FOR UPDATE');
  });
  it('restores an administrator-taken-down job only when a paid publish order exists', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const moderationCreate = jest.fn().mockResolvedValue(undefined);
    const service = createService({
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job_1',
          publisherScope: PublicationScope.COMMUNITY,
          communityId: 'community_a',
          status: JobPostStatus.TAKEN_DOWN,
          moderationAuthority: ModerationAuthority.COMMUNITY,
          moderationVersion: 2,
        }),
        updateMany,
      },
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([{ id: 'job_1' }])
        .mockResolvedValueOnce([{ id: 'order_paid', status: PayStatus.PAID }]),
      moderationRecord: { create: moderationCreate },
    }, { assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY) });

    await expect(service.restoreJobPost('job_1', 2, 'admin_circle', circleAccess)).resolves.toEqual({
      id: 'job_1',
      status: JobPostStatus.PUBLISHED,
      moderationVersion: 3,
    });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: JobPostStatus.TAKEN_DOWN,
        moderationAuthority: ModerationAuthority.COMMUNITY,
        moderationVersion: 2,
      }),
      data: expect.objectContaining({ moderationAuthority: null }),
    }));
    expect(moderationCreate).toHaveBeenCalled();
  });

  it.each(['merchant', 'anon-group', 'unknown-target'])(
    'rejects unsupported %s reports for circle administrators',
    async (targetType) => {
      const updateMany = jest.fn();
      const service = createService({
        moderationRecord: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'report_1',
            targetType,
            targetId: 'target_1',
            status: 'PENDING',
            reporterId: null,
          }),
          updateMany,
        },
      }, {});

      await expect(
        service.resolveReport('report_1', 'admin_circle', { action: 'reject' }, circleAccess),
      ).rejects.toMatchObject({ bizCode: 10003 });
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it('authorizes application reports through the related job community', async () => {
    const assertModerationTarget = jest.fn().mockResolvedValue(ModerationAuthority.COMMUNITY);
    const service = createService({
      moderationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'report_1',
          targetType: 'application',
          targetId: 'application_1',
          status: 'PENDING',
          reporterId: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({
          jobPost: {
            publisherScope: PublicationScope.COMMUNITY,
            communityId: 'community_a',
          },
        }),
      },
    }, { assertModerationTarget });

    await expect(
      service.resolveReport('report_1', 'admin_circle', { action: 'reject' }, circleAccess),
    ).resolves.toEqual({ id: 'report_1', status: 'REJECTED' });
    expect(assertModerationTarget).toHaveBeenCalledWith(
      circleAccess,
      PublicationScope.COMMUNITY,
      'community_a',
    );
  });

  it('filters circle report lists by the persisted scope snapshot without loading all content ids', async () => {
    const scopeFilter = { in: ['community_a'] };
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({
      moderationRecord: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
      },
      user: { findMany: jest.fn() },
      post: { findMany: jest.fn() },
      anonymousPost: { findMany: jest.fn() },
      jobPost: { findMany: jest.fn() },
    }, {
      assertModerationContext: jest.fn().mockResolvedValue('COMMUNITY'),
      communityIdWhere: jest.fn().mockReturnValue(scopeFilter),
    });

    await expect(service.listReports('PENDING', 1, 20, circleAccess)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: {
        reporterId: { not: null },
        targetPublisherScope: PublicationScope.COMMUNITY,
        targetCommunityId: scopeFilter,
        status: 'PENDING',
      },
    }));
  });
  it('帖子举报下架 CAS 失败时不应先结案举报', async () => {
    const reportUpdate = jest.fn();
    const transaction = jest.fn(async (callback: (tx: Record<string, unknown>) => unknown) => callback({
      post: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      moderationRecord: { create: jest.fn(), updateMany: reportUpdate },
    }));
    const service = createService({
      moderationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'report_1',
          targetType: 'post',
          targetId: 'post_1',
          status: ModerationStatus.PENDING,
          reporterId: null,
        }),
      },
      post: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post_1',
          authorId: 'author_1',
          communityId: 'community_a',
          publisherScope: PublicationScope.COMMUNITY,
          status: PostStatus.APPROVED,
          moderationAuthority: null,
          moderationVersion: 2,
        }),
      },
      $transaction: transaction,
    }, {
      assertModerationTarget: jest.fn().mockResolvedValue(ModerationAuthority.PLATFORM),
    });

    await expect(service.resolveReport(
      'report_1',
      'admin_platform',
      { action: 'approve', takedown: true },
      platformAccess,
    )).rejects.toMatchObject({ bizCode: 40004 });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(reportUpdate).not.toHaveBeenCalled();
  });
  it('keeps the conflict status on BizException stable', () => {
    const error = new BizException(40004, '内容已变更，请刷新后重试', HttpStatus.CONFLICT);
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
  });
});