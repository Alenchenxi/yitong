import { request } from './request';
import type { PostVo } from './confession';
import type { AnonPostVo } from './treehole';

// CR-001 广场混合流：union feed 接口
// 红线：anon_post kind 的 data 严禁回填真实身份字段

export type FeedItemVo =
  | { kind: 'post'; data: PostVo }
  | { kind: 'anon_post'; data: AnonPostVo };

export interface SquareFeedResult {
  list: FeedItemVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * 广场混合流：推荐 / 最新 tab
 * @param sort  'recommend' | 'latest'（关注流不暴露，保留在表白墙完整入口）
 */
export function squareFeed(
  cursor?: string,
  limit = 20,
  sort: 'recommend' | 'latest' = 'recommend',
): Promise<SquareFeedResult> {
  const qs = `?limit=${limit}&sort=${sort}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  // 双 token 设计：Authorization 头走 access token（全局 request 注入），
  // x-anon-token 头走 anon token（额外 header）
  const app = getApp<{ globalData: { anonToken?: string } }>();
  const header: Record<string, string> = {};
  if (app.globalData.anonToken) header['x-anon-token'] = app.globalData.anonToken;
  return request<SquareFeedResult>({ url: `/square/feed${qs}`, header });
}
