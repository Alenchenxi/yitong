import { Injectable } from '@nestjs/common';
import {
  CommunityStatus,
  JobVisibilityScope,
  PublicationScope,
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
          {
            publisherScope: PublicationScope.PLATFORM,
            visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
          },
          {
            publisherScope: PublicationScope.COMMUNITY,
            visibilityScope: JobVisibilityScope.COMMUNITY,
            communityId,
            community: { is: { status: CommunityStatus.ACTIVE } },
          },
        ],
      },
      { OR: [{ expireAt: null }, { expireAt: { gt: now } }] },
    ];
  }
}
