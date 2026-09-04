import type { PostVo } from '../confession/types';
import type { AnonPostVo } from '../treehole/types';
import type { JobPostVo } from '../job/types';

// 广场 union feed 条目：表白墙帖 + 树洞匿名帖 + 兼职岗位（圈子动态混合流）
// 红线：anon_post kind 的 data 严禁回填 authorId/authorNickname/authorAvatarUrl 等真实身份字段
export type FeedItemVo =
  | { kind: 'post'; data: PostVo }
  | { kind: 'anon_post'; data: AnonPostVo }
  | { kind: 'job_post'; data: JobPostVo };

export interface SquareFeedResult {
  list: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

// 今日上头：近24h 浏览量 TopN（仅表白墙和树洞，无游标；附 viewCount 供展示）
export type TodayHitItem = Extract<FeedItemVo, { kind: 'post' | 'anon_post' }> & { viewCount: number };
export interface SquareTodayHitResult {
  list: TodayHitItem[];
}
