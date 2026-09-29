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
import { LocationService } from '../../src/modules/job/location.service';
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
      // P2-79:坐标语义 BD-09(存储系)。此值 = gcj02ToBd09(116.4, 39.9)，
      // 与下方 payload 重发的 GCJ-02 原值经服务端转换后一致，幂等比较应命中。
      // 地址不含城市名、圈子 region 为空 → 服务端解析 city=null，草稿同存 null。
      locationLng: { toString: () => '116.406380' },
      locationLat: { toString: () => '39.906349' },
      locationCity: null,
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
      new LocationService(), // P2-79:真实本地实现,坐标转换/城市解析参与幂等比较
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
      // P2-79:客户端持微信选点 GCJ-02 原值重发，转换在服务端完成
      locationLng: 116.4,
      locationLat: 39.9,
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
