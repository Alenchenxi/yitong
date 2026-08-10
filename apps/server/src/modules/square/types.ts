import type { PostVo } from '../confession/types';
import type { AnonPostVo } from '../treehole/types';

// 广场 union feed 条目：表白墙帖 + 树洞匿名帖
// 红线：anon_post kind 的 data 严禁回填 authorId/authorNickname/authorAvatarUrl 等真实身份字段
export type FeedItemVo =
  | { kind: 'post'; data: PostVo }
  | { kind: 'anon_post'; data: AnonPostVo };

export interface SquareFeedResult {
  list: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
}
