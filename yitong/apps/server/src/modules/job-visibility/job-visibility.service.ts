import { Injectable } from '@nestjs/common';
import {
  CommunityStatus,
  JobVisibilityScope,
  type Prisma,
} from '@prisma/client';

@Injectable()
export class JobVisibilityPolicyService {
  // P2-75 发岗全圈同步：新建岗与存量迁移后可见范围统一 ALL_COMMUNITIES；
  // 保留旧 COMMUNITY+归属圈分支兜底迁移窗口内未刷新的存量，命中后仍要求归属圈 ACTIVE。
  buildFilters(
    communityId: string,
    now = new Date(),
  ): Prisma.JobPostWhereInput[] {
    return [
      {
        OR: [
          {
            visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
          },
          {
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
