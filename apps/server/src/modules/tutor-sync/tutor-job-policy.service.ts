import { HttpStatus, Injectable } from '@nestjs/common';
import { JobApplyMode, JobPostStatus, type Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { tryAcquireTutorSyncLock } from './tutor-sync.lock';
import {
  TUTOR_SYNC_CONTACT_INSTRUCTION,
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
      && post.publisherName === TUTOR_SYNC_PUBLISHER;
  }

  contactInstruction(post: TutorJobIdentity): string | null {
    return this.isExternalTutorPost(post) ? TUTOR_SYNC_CONTACT_INSTRUCTION : null;
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
      await tx.jobPost.updateMany({
        where: { id: jobPostId, status: JobPostStatus.PUBLISHED },
        data,
      });
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
