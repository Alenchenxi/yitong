import { JobApplyMode, JobCategory, JobDuration, JobPostStatus, JobVisibilityScope, PublicationScope, Settlement } from '@prisma/client';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';
import { JobService } from '../../src/modules/job/job.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';

const NOW = new Date('2026-09-28T08:00:00.000Z');

function jobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job_edit_1',
    merchantId: 'merchant_1',
    communityId: 'community_a',
    title: '周末奶茶店兼职',
    description: '协助出餐',
    requirements: null,
    contactPhoneSnapshot: '13800000000',
    contactWechatSnapshot: 'merchant-job',
    salary: '150元/天',
    salaryAmount: 150,
    location: '校门口奶茶店',
    locationLng: 116.4,
    locationLat: 39.9,
    locationCity: '北京',
    category: JobCategory.CATERING,
    customCategory: null,
    settlement: Settlement.DAILY,
    workDates: ['周六'],
    workPeriods: ['全天'],
    headcount: 2,
    urgent: false,
    featured: false,
    online: false,
    questions: [],
    duration: JobDuration.D30,
    expireAt: new Date('2026-10-28T08:00:00.000Z'),
    visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
    publisherScope: PublicationScope.COMMUNITY,
    applyMode: JobApplyMode.IN_APP,
    publisherName: null,
    status: JobPostStatus.PENDING,
    takenDownAt: null,
    deletedAt: null,
    publishedAt: null,
    createdAt: NOW,
    merchant: {
      userId: 'merchant_user',
      shopName: '测试店铺',
      contactPhone: '13800000000',
      contactWechat: 'merchant-job',
    },
    ...overrides,
  };
}

function buildService(fixture: Record<string, unknown>) {
  const update = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...fixture, ...data }));
  const prisma = {
    jobPost: {
      findUnique: jest.fn().mockResolvedValue(fixture),
      update,
    },
  };
  const service = new JobService(
    prisma as never,
    { checkText: jest.fn().mockResolvedValue(undefined) } as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { assertUserCanParticipate: jest.fn().mockResolvedValue(undefined) } as never,
    new JobVisibilityPolicyService(),
    new TutorJobPolicyService(),
  );
  return { service, update };
}

// P2-77 编辑岗位：title / category（含自定义岗位类型）创建后不可改
describe('岗位编辑标题与分类不可变（P2-77）', () => {
  it('改标题被拒绝（40003），不落库', async () => {
    const { service, update } = buildService(jobFixture());
    await expect(service.updatePost('merchant_user', 'job_edit_1', { title: '改成新标题' } as never))
      .rejects.toMatchObject({ bizCode: 40003 });
    expect(update).not.toHaveBeenCalled();
  });

  it('改预设分类被拒绝（40003），不落库', async () => {
    const { service, update } = buildService(jobFixture());
    await expect(service.updatePost('merchant_user', 'job_edit_1', { category: 'RETAIL' } as never))
      .rejects.toMatchObject({ bizCode: 40003 });
    expect(update).not.toHaveBeenCalled();
  });

  it('预设岗改自定义岗位类型被拒绝（40003），不落库', async () => {
    const { service, update } = buildService(jobFixture());
    await expect(
      service.updatePost('merchant_user', 'job_edit_1', { customCategory: '新自定义类型', isCustomCategory: true } as never),
    ).rejects.toMatchObject({ bizCode: 40003 });
    expect(update).not.toHaveBeenCalled();
  });

  it('自定义岗改自定义类型文案被拒绝（40003），不落库', async () => {
    const { service, update } = buildService(jobFixture({
      category: JobCategory.LONG_TERM,
      customCategory: '奶茶小工',
    }));
    await expect(
      service.updatePost('merchant_user', 'job_edit_1', { customCategory: '改行文案' } as never),
    ).rejects.toMatchObject({ bizCode: 40003 });
    expect(update).not.toHaveBeenCalled();
  });

  it('原样提交标题/分类（同值）放行，其余字段正常更新', async () => {
    const fixture = jobFixture();
    const { service, update } = buildService(fixture);
    const vo = await service.updatePost('merchant_user', 'job_edit_1', {
      title: fixture.title,
      category: JobCategory.CATERING,
      customCategory: '',
      isCustomCategory: false,
      salary: '200元/天',
    } as never);
    expect(update).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[0] as unknown[])[0]).toMatchObject({ data: { salary: '200元/天', salaryAmount: 200 } });
    expect(vo.title).toBe(fixture.title);
    expect(vo.category).toBe(JobCategory.CATERING);
  });
});
