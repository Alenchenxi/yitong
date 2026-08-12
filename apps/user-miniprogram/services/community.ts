import { request } from './request';

// 圈子（Community）：用户可加入/创建/切换的社区（非表白墙发帖分类 Circle）

export interface CommunityVo {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  memberCount: number;
  postCount: number;
  status: 'ACTIVE' | 'DISABLED';
  isMember: boolean;
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  createdAt: string;
}

export interface BannerVo {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
}

/** 全部 ACTIVE 圈子 + 当前用户 isMember/myRole */
export function listCommunities(): Promise<CommunityVo[]> {
  return request<CommunityVo[]>({ url: '/community/list' });
}

/** 我加入的圈子 + 当前 activeId */
export function listMyCommunities(): Promise<{ activeId: string | null; list: CommunityVo[] }> {
  return request<{ activeId: string | null; list: CommunityVo[] }>({ url: '/community/mine' });
}

/** 惰性确保的当前圈子（广场启动引导） */
export function getActiveCommunity(): Promise<CommunityVo> {
  return request<CommunityVo>({ url: '/community/active' });
}

/** 圈子详情 */
export function getCommunity(id: string): Promise<CommunityVo> {
  return request<CommunityVo>({ url: `/community/${id}` });
}

/** 创建圈子（creator → OWNER + 成员 + 置当前） */
export function createCommunity(data: { name: string; logo?: string; description?: string }): Promise<CommunityVo> {
  return request<CommunityVo>({ url: '/community', method: 'POST', data });
}

/** 加入圈子（同时置为当前圈子） */
export function joinCommunity(id: string): Promise<{ id: string }> {
  return request<{ id: string }>({ url: `/community/${id}/join`, method: 'POST' });
}

/** 退出圈子（圈主不可退） */
export function leaveCommunity(id: string): Promise<{ id: string }> {
  return request<{ id: string }>({ url: `/community/${id}/leave`, method: 'POST' });
}

/** 切换当前圈子（须已是成员） */
export function switchCommunity(id: string): Promise<{ id: string }> {
  return request<{ id: string }>({ url: '/community/switch', method: 'POST', data: { communityId: id } });
}

/** 广告位轮播（圈子 + 全局 Banner） */
export function listBanners(communityId: string): Promise<BannerVo[]> {
  return request<BannerVo[]>({ url: `/square/banners?communityId=${encodeURIComponent(communityId)}` });
}
