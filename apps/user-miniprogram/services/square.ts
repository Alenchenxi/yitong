import { request } from './request';
import type { PostVo } from './confession';
import type { AnonPostVo } from './treehole';
import type { JobPostVo } from './job';

// 广场（圈子）数据：union feed 混合流 + 今日上头
// 红线：anon_post kind 的 data 严禁回填真实身份字段

export type FeedItemVo =
  | { kind: 'post'; data: PostVo }
  | { kind: 'anon_post'; data: AnonPostVo }
  | { kind: 'job_post'; data: JobPostVo };

export interface SquareFeedResult {
  list: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type TodayHitItem = FeedItemVo & { viewCount: number };
export interface SquareTodayHitResult {
  list: TodayHitItem[];
}

// 组装 x-anon-token 头（双 token：access 走全局 Authorization，anon 走额外 header）
function anonHeader(): Record<string, string> {
  const app = getApp<{ globalData: { anonToken?: string } }>();
  const header: Record<string, string> = {};
  if (app.globalData.anonToken) header['x-anon-token'] = app.globalData.anonToken;
  return header;
}

/**
 * 圈子动态混合流：表白墙帖 + 树洞帖 + 兼职岗位
 * @param sort 'recommend' | 'latest'（关注流不暴露）
 * @param communityId 圈子作用域（缺省服务端取当前圈子）
 */
export function squareFeed(
  cursor?: string,
  limit = 20,
  sort: 'recommend' | 'latest' = 'recommend',
  communityId?: string,
): Promise<SquareFeedResult> {
  const qs = `?limit=${limit}&sort=${sort}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${
    communityId ? `&communityId=${encodeURIComponent(communityId)}` : ''
  }`;
  return request<SquareFeedResult>({ url: `/square/feed${qs}`, header: anonHeader() });
}

/** 今日上头：近24h 浏览量 TopN（表白墙帖 + 树洞帖，无游标） */
export function squareTodayHit(communityId?: string, limit = 10): Promise<SquareTodayHitResult> {
  const qs = `?limit=${limit}${communityId ? `&communityId=${encodeURIComponent(communityId)}` : ''}`;
  return request<SquareTodayHitResult>({ url: `/square/today-hit${qs}`, header: anonHeader() });
}
