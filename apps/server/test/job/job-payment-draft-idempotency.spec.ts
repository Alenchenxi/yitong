import {
  JobApplyMode,
  JobCategory,
  JobDuration,
  JobPostStatus,
  JobVisibilityScope,
  MerchantStatus,
  PublicationScope,
  Settlement,
} from '@prisma/client';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';
import { JobService } from '../../src/modules/job/job.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';

describe('JobService 待支付岗位草稿幂等', () => {
  it('重新提交完全一致且已有待支付订单的岗位时复用原草稿', async () => {
    const candidate = {
      id: 'job_existing',
      merchantId: 'merchant_1',
      communityId: 'community_1',
      title: '活动协助',
      description: '负责现场协助',
      requirements: null,
      contactPhoneSnapshot: '13800000000',
      contactWechatSnapshot: 'merchant',
      salary: '150元/天',
      salaryAmount: 150,
      location: '大学生活动中心',
      locationPoiId: 'poi_1',
      locationLng: { toString: () => '116.400000' },
      locationLat: { toString: () => '39.900000' },
      locationCity: '北京',
      category: JobCategory.CATERING,
      customCategory: null,
      settlement: Settlement.DAILY,
      workDates: [],
      workPeriods: ['全天'],
      headcount: 2,
      urgent: false,
      featured: false,
      online: false,
      questions: [],
      duration: JobDuration.D30,
      expireAt: null,
      visibilityScope: JobVisibilityScope.COMMUNITY,
      publisherScope: PublicationScope.COMMUNITY,
      applyMode: JobApplyMode.IN_APP,
      publisherName: null,
      status: JobPostStatus.PENDING,
      takenDownAt: null,
      deletedAt: null,
      createdAt: new Date('2026-09-13T00:00:00.000Z'),
      merchant: {
        userId: 'user_1',
        shopName: '测试商家',
        contactPhone: '13800000000',
        contactWechat: 'merchant',
      },
    };
    const jobPost = {
      findMany: jest.fn().mockResolvedValue([candidate]),
      findUnique: jest.fn().mockResolvedValue(candidate),
      create: jest.fn(),
    };
    const prisma = {
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'merchant_1',
          status: MerchantStatus.APPROVED,
          contactPhone: '13800000000',
          contactWechat: 'merchant',
        }),
      },
      community: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      paymentOrder: { findMany: jest.fn().mockResolvedValue([{ jobPostId: candidate.id }]) },
      jobPost,
    };
    const service = new JobService(
      prisma as never,
      { checkText: jest.fn().mockResolvedValue(undefined) } as never,
      { create: jest.fn() } as never,
      {} as never,
      { assertUserCanParticipate: jest.fn().mockResolvedValue(undefined) } as never,
      new JobVisibilityPolicyService(),
      new TutorJobPolicyService(),
      { resolveForUser: jest.fn().mockResolvedValue(PublicationScope.COMMUNITY) } as never,
    );

    const result = await service.createPost('user_1', {
      title: candidate.title,
      description: candidate.description,
      salary: candidate.salary,
      location: candidate.location,
      locationPoiId: candidate.locationPoiId,
      locationLng: 116.4,
      locationLat: 39.9,
      locationCity: candidate.locationCity,
      category: JobCategory.CATERING,
      settlement: Settlement.DAILY,
      workPeriods: ['全天'],
      headcount: 2,
      duration: JobDuration.D30,
      communityId: candidate.communityId,
    });

    expect(result.id).toBe(candidate.id);
    expect(jobPost.create).not.toHaveBeenCalled();
  });
});
