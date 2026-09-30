import { HttpStatus, Injectable } from '@nestjs/common';
import { JobApplyMode, JobPostStatus, type Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { tryAcquireTutorSyncLock } from './tutor-sync.lock';
import {
  TUTOR_SYNC_LEGACY_PUBLISHERS,
  TUTOR_SYNC_PUBLISHER,
} from './tutor-sync.types';

type TutorJobIdentity = {
  applyMode?: JobApplyMode;
  publisherName?: string | null;
};

@Injectable()
export class TutorJobPolicyService {
  isExternalTutorPost(post: TutorJobIdentity): boolean {
    return post.applyMode === JobApplyMode.CONTACT_ONLY
      && (
        post.publisherName === TUTOR_SYNC_PUBLISHER
        || TUTOR_SYNC_LEGACY_PUBLISHERS.some((name) => name === post.publisherName)
      );
  }

  contactInstruction(
    post: TutorJobIdentity,
    contact?: { phone: string | null; wechat: string | null },
  ): string | null {
    if (!this.isExternalTutorPost(post)) return null;
    const parts = [
      contact?.phone ? `手机号 ${contact.phone}` : null,
      contact?.wechat ? `微信号 ${contact.wechat}` : null,
    ].filter((value): value is string => !!value);
    return parts.length > 0
      ? `请联系当前圈子圈主：${parts.join(' · ')}`
      : '当前圈子圈主暂未填写联系方式';
  }

  async takeDownJobPostWithGuard(
    tx: Prisma.TransactionClient,
    jobPostId: string,
    blockedAt: Date,
    options: { requireTutorBinding: boolean; publishedOnly: boolean },
  ): Promise<boolean> {
    const binding = await tx.tutorJobSyncBinding.findUnique({
      where: { jobPostId },
      select: { id: true },
    });
    if (!binding && options.requireTutorBinding) return false;
    if (binding && !(await tryAcquireTutorSyncLock(tx))) {
      throw new BizException(
        40004,
        '家教同步处理中，请稍后重试',
        HttpStatus.CONFLICT,
      );
    }

    const data = { status: JobPostStatus.TAKEN_DOWN, takenDownAt: blockedAt };
    if (options.publishedOnly) {
      const result = await tx.jobPost.updateMany({
        where: { id: jobPostId, status: JobPostStatus.PUBLISHED },
        data,
      });
      if (result.count !== 1) return false;
    } else {
      await tx.jobPost.update({ where: { id: jobPostId }, data });
    }
    if (binding) {
      await tx.tutorJobSyncBinding.updateMany({
        where: { jobPostId },
        data: { platformBlockedAt: blockedAt },
      });
    }
    return true;
  }
}
