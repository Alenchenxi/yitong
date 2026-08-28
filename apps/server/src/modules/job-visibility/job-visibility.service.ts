import { Injectable } from '@nestjs/common';
import {
  CommunityStatus,
  JobVisibilityScope,
  type Prisma,
} from '@prisma/client';

@Injectable()
export class JobVisibilityPolicyService {
  buildFilters(
    communityId: string,
    now = new Date(),
  ): Prisma.JobPostWhereInput[] {
    return [
      {
        OR: [
          { visibilityScope: JobVisibilityScope.ALL_COMMUNITIES },
          {
            communityId,
            community: { is: { status: CommunityStatus.ACTIVE } },
          },
        ],
      },
      { OR: [{ expireAt: null }, { expireAt: { gt: now } }] },
    ];
  }
}
