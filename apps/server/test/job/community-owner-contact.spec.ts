import {
  JobApplyMode,
  JobCategory,
  JobDuration,
  JobPostStatus,
  JobVisibilityScope,
  PublicationScope,
  Settlement,
} from '@prisma/client';
import { JobService } from '../../src/modules/job/job.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';
import { TUTOR_SYNC_PUBLISHER } from '../../src/modules/tutor-sync/tutor-sync.types';

function buildService() {
  return new JobService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new TutorJobPolicyService(),
  );
}

function externalTutorPost() {
  return {
    id: 'job_tutor',
    merchantId: 'merchant_system',
    title: '数学家教',
    description: '辅导数学',
    requirements: null,
    contactPhoneSnapshot: 'source-phone-must-not-leak',
    contactWechatSnapshot: 'source-wechat-must-not-leak',
    salary: '200元/次',
    salaryAmount: 200,
    location: '杭州',
    category: JobCategory.TUTORING,
    settlement: Settlement.COMPLETION,
    workDates: [],
    workPeriods: [],
    headcount: 1,
    urgent: false,
    online: false,
    questions: [],
    duration: JobDuration.D90,
    expireAt: null,
    visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
    publisherScope: PublicationScope.PLATFORM,
    applyMode: JobApplyMode.CONTACT_ONLY,
    publisherName: TUTOR_SYNC_PUBLISHER,
    status: JobPostStatus.PUBLISHED,
    createdAt: new Date('2026-09-08T00:00:00.000Z'),
    merchant: {
      shopName: '系统商家',
      contactPhone: 'merchant-phone-must-not-leak',
      contactWechat: 'merchant-wechat-must-not-leak',
    },
  };
}

describe('同步家教使用当前圈子创建人联系方式', () => {
  it('覆盖同步源和系统商家联系方式', () => {
    const vo = buildService().toPostVo(externalTutorPost(), false, {
      phone: '13800138000',
      wechat: 'circle-owner',
    });
    expect(vo.contactPhone).toBe('13800138000');
    expect(vo.contactWechat).toBe('circle-owner');
    expect(vo.contactInstruction).toBe(
      '请联系当前圈子圈主：手机号 13800138000 · 微信号 circle-owner',
    );
  });

  it('圈主未填写时不回退到同步源联系方式', () => {
    const vo = buildService().toPostVo(externalTutorPost(), false, {
      phone: null,
      wechat: null,
    });
    expect(vo.contactPhone).toBeNull();
    expect(vo.contactWechat).toBeNull();
    expect(vo.contactInstruction).toBe('当前圈子圈主暂未填写联系方式');
  });
});

describe('同步家教圈子联系人解析', () => {
  const tutorIdentity = {
    applyMode: JobApplyMode.CONTACT_ONLY,
    publisherName: TUTOR_SYNC_PUBLISHER,
  };

  function resolveContact(
    prisma: Record<string, unknown>,
    posts: Array<{
      applyMode?: JobApplyMode;
      publisherName?: string | null;
      publisherScope?: PublicationScope;
    }> = [tutorIdentity],
  ) {
    const service = new JobService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new TutorJobPolicyService(),
    );
    return (service as unknown as {
      resolveCommunityOwnerContact(
        posts: Array<{
          applyMode?: JobApplyMode;
          publisherName?: string | null;
          publisherScope?: PublicationScope;
        }>,
        communityId: string | null,
      ): Promise<{ phone: string | null; wechat: string | null } | null>;
    }).resolveCommunityOwnerContact(posts, 'community_a');
  }

  it('优先返回授权圈子管理员当前填写的联系方式', async () => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue({ ownerId: 'owner_a' }) },
      adminUser: { findFirst: jest.fn().mockResolvedValue({ openid: 'admin-openid' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ phone: '13800138000', wechat: 'circle-admin' }) },
    };

    await expect(resolveContact(prisma)).resolves.toEqual({
      phone: '13800138000',
      wechat: 'circle-admin',
    });
    expect(prisma.adminUser.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        adminType: { active: true, deletedAt: null, isPlatform: false },
        OR: expect.arrayContaining([
          { allCommunities: true },
          { communityScopes: { some: { communityId: 'community_a' } } },
        ]),
      }),
    }));
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { openid: 'admin-openid' },
      select: { phone: true, wechat: true },
    });
  });

  it('无可用圈子管理员联系方式时回退到圈主当前联系方式', async () => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue({ ownerId: 'owner_a' }) },
      adminUser: { findFirst: jest.fn().mockResolvedValue({ openid: 'admin-openid' }) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ phone: null, wechat: null })
          .mockResolvedValueOnce({ phone: '13900139000', wechat: 'circle-owner' }),
      },
    };

    await expect(resolveContact(prisma)).resolves.toEqual({
      phone: '13900139000',
      wechat: 'circle-owner',
    });
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'owner_a' },
      select: { phone: true, wechat: true },
    });
  });
});

function platformAdminPost() {
  return {
    id: 'job_platform',
    merchantId: 'merchant_platform',
    title: '校园推广专员',
    description: '负责校园推广',
    requirements: null,
    contactPhoneSnapshot: 'platform-admin-phone',
    contactWechatSnapshot: 'platform-admin-wechat',
    salary: '150元/天',
    salaryAmount: 150,
    location: '杭州',
    category: JobCategory.PROMOTION,
    settlement: Settlement.DAILY,
    workDates: [],
    workPeriods: [],
    headcount: 1,
    urgent: false,
    online: false,
    questions: [],
    duration: JobDuration.D30,
    expireAt: null,
    visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
    publisherScope: PublicationScope.PLATFORM,
    applyMode: JobApplyMode.CONTACT_ONLY,
    publisherName: '燚桐官方',
    status: JobPostStatus.PUBLISHED,
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
    merchant: {
      shopName: '平台官方商家',
      contactPhone: 'merchant-phone-fallback',
      contactWechat: 'merchant-wechat-fallback',
    },
  };
}

describe('平台管理员发布岗位使用圈子管理员联系方式', () => {
  it('同步家教同款：CONTACT_ONLY 岗位优先展示圈子管理员联系方式', () => {
    const vo = buildService().toPostVo(platformAdminPost(), false, {
      phone: '13800138000',
      wechat: 'circle-admin',
    });
    expect(vo.contactPhone).toBe('13800138000');
    expect(vo.contactWechat).toBe('circle-admin');
  });

  it('圈子侧整体未填写时回退发岗时平台管理员联系方式快照', () => {
    const vo = buildService().toPostVo(platformAdminPost(), false, null);
    expect(vo.contactPhone).toBe('platform-admin-phone');
    expect(vo.contactWechat).toBe('platform-admin-wechat');
  });

  it('圈子侧整体未填写才回退，电话/微信不与快照混源', () => {
    const vo = buildService().toPostVo(platformAdminPost(), false, {
      phone: null,
      wechat: 'circle-admin',
    });
    expect(vo.contactPhone).toBeNull();
    expect(vo.contactWechat).toBe('circle-admin');
  });

  it('快照也为空时保留存量商家资料兜底', () => {
    const post = {
      ...platformAdminPost(),
      contactPhoneSnapshot: null,
      contactWechatSnapshot: null,
    };
    const vo = buildService().toPostVo(post, false, null);
    expect(vo.contactPhone).toBe('merchant-phone-fallback');
    expect(vo.contactWechat).toBe('merchant-wechat-fallback');
  });

  it('IN_APP 岗位未报名仍不展示联系方式（展示时机不变）', () => {
    const post = { ...platformAdminPost(), applyMode: JobApplyMode.IN_APP };
    const vo = buildService().toPostVo(post, false, {
      phone: '13800138000',
      wechat: 'circle-admin',
    });
    expect(vo.contactPhone).toBeNull();
    expect(vo.contactWechat).toBeNull();
  });

  it('IN_APP 岗位报名后展示圈子管理员联系方式', () => {
    const post = { ...platformAdminPost(), applyMode: JobApplyMode.IN_APP };
    const vo = buildService().toPostVo(post, true, {
      phone: '13800138000',
      wechat: null,
    });
    expect(vo.contactPhone).toBe('13800138000');
    expect(vo.contactWechat).toBeNull();
  });

  it('商家自有岗位不受影响：仍使用发岗快照', () => {
    const post = {
      ...platformAdminPost(),
      publisherScope: PublicationScope.COMMUNITY,
      visibilityScope: JobVisibilityScope.COMMUNITY,
    };
    const vo = buildService().toPostVo(post, false, {
      phone: '13800138000',
      wechat: 'circle-admin',
    });
    expect(vo.contactPhone).toBe('platform-admin-phone');
    expect(vo.contactWechat).toBe('platform-admin-wechat');
  });
});

describe('平台管理员岗位圈子联系方式解析入口', () => {
  function resolveFor(
    posts: Array<{
      applyMode?: JobApplyMode;
      publisherName?: string | null;
      publisherScope?: PublicationScope;
    }>,
    prisma: Record<string, unknown>,
  ) {
    const service = new JobService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new TutorJobPolicyService(),
    );
    return (service as unknown as {
      resolveCommunityOwnerContact(
        posts: Array<{
          applyMode?: JobApplyMode;
          publisherName?: string | null;
          publisherScope?: PublicationScope;
        }>,
        communityId: string | null,
      ): Promise<{ phone: string | null; wechat: string | null } | null>;
    }).resolveCommunityOwnerContact(posts, 'community_a');
  }

  it('平台管理员岗位触发圈子管理员联系方式解析', async () => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue({ ownerId: 'owner_a' }) },
      adminUser: { findFirst: jest.fn().mockResolvedValue({ openid: 'admin-openid' }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ phone: '13800138000', wechat: 'circle-admin' }),
      },
    };

    await expect(
      resolveFor(
        [
          {
            applyMode: JobApplyMode.CONTACT_ONLY,
            publisherName: '燚桐官方',
            publisherScope: PublicationScope.PLATFORM,
          },
        ],
        prisma,
      ),
    ).resolves.toEqual({ phone: '13800138000', wechat: 'circle-admin' });
  });

  it('平台岗位：圈子管理员未填写时同样回退圈主联系方式', async () => {
    const prisma = {
      community: { findFirst: jest.fn().mockResolvedValue({ ownerId: 'owner_a' }) },
      adminUser: { findFirst: jest.fn().mockResolvedValue({ openid: 'admin-openid' }) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ phone: null, wechat: null })
          .mockResolvedValueOnce({ phone: '13900139000', wechat: 'circle-owner' }),
      },
    };

    await expect(
      resolveFor(
        [
          {
            applyMode: JobApplyMode.CONTACT_ONLY,
            publisherName: '燚桐官方',
            publisherScope: PublicationScope.PLATFORM,
          },
        ],
        prisma,
      ),
    ).resolves.toEqual({ phone: '13900139000', wechat: 'circle-owner' });
    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: 'owner_a' },
      select: { phone: true, wechat: true },
    });
  });

  it('商家自有岗位不触发圈子联系方式解析', async () => {
    const prisma = {
      community: { findFirst: jest.fn() },
      adminUser: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    await expect(
      resolveFor(
        [{ applyMode: JobApplyMode.CONTACT_ONLY, publisherScope: PublicationScope.COMMUNITY }],
        prisma,
      ),
    ).resolves.toBeNull();
    expect(prisma.community.findFirst).not.toHaveBeenCalled();
  });
});
