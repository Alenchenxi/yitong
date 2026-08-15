import { request } from './request';

// 圈子（Community）：用户可加入/创建/切换的社区（非表白墙发帖分类 Circle）

export interface CommunityVo {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  category: string;
  region: string | null;
  location: string | null;
  memberCount: number;
  postCount: number;
  status: 'ACTIVE' | 'DISABLED' | 'PENDING'; // P2-26 加 PENDING
  rejectReason: string | null; // P2-26 仅被拒态有值
  isMember: boolean;
  myRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  createdAt: string;
}

/** P2-26 创建圈子返回（带 pending 切 toast） */
export interface CreateCommunityResult extends CommunityVo {
  pending: boolean;
}

export interface BannerVo {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
}

/** 全部 ACTIVE 圈子 + 当前用户 isMember/myRole；可选按 category 过滤（广场左侧分类） */
export function listCommunities(category?: string): Promise<CommunityVo[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return request<CommunityVo[]>({ url: `/community/list${query}` });
}

/** 圈子搜索（name 模糊匹配，最多 20 条） */
export function searchCommunities(keyword: string): Promise<CommunityVo[]> {
  return request<CommunityVo[]>({ url: `/community/search?keyword=${encodeURIComponent(keyword)}` });
}

/** 我加入的圈子 + 当前 activeId */
export function listMyCommunities(): Promise<{ activeId: string | null; list: CommunityVo[] }> {
  return request<{ activeId: string | null; list: CommunityVo[] }>({ url: '/community/mine' });
}

/** P2-26 creator 视角分桶：我的全部圈子（已加入 / 待审核 / 未通过） */
export interface MyCommunitiesAll {
  activeId: string | null;
  joined: CommunityVo[];
  pending: CommunityVo[];
  rejected: CommunityVo[];
}
export function listMyCommunitiesAll(): Promise<MyCommunitiesAll> {
  return request<MyCommunitiesAll>({ url: '/community/mine/all' });
}

/** 当前圈子（未加入任何圈子 → null，由广场引导到加入页） */
export function getActiveCommunity(): Promise<CommunityVo | null> {
  return request<CommunityVo | null>({ url: '/community/active' });
}

/** 圈子详情 */
export function getCommunity(id: string): Promise<CommunityVo> {
  return request<CommunityVo>({ url: `/community/${id}` });
}

/** 创建圈子（creator → OWNER + 成员 + 置当前；category/region/location 必填）
 *  P2-26 返回 CreateCommunityResult 含 pending 标记，按此切 toast 文案 */
export function createCommunity(data: { name: string; logo?: string; description?: string; category: string; region: string; location: string }): Promise<CreateCommunityResult> {
  return request<CreateCommunityResult>({ url: '/community', method: 'POST', data });
}

/** P2-26 creator 重提被拒圈 */
export function resubmitCommunity(id: string): Promise<CreateCommunityResult> {
  return request<CreateCommunityResult>({ url: `/community/${id}/resubmit`, method: 'POST' });
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
