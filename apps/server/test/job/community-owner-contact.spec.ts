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
