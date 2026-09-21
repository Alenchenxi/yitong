import { request } from './request';

// 圈子（Community）：用户可加入/创建/切换的社区（非表白墙发帖分类 Circle）

export interface CommunityVo {
  id: string;
  name: string;
  logo: string | null;
  backgroundImage: string | null;
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
  /** P2-70 发岗免支付口径：该圈在我名下管理（圈内 OWNER/ADMIN 或管理端分配的圈子管理员授权）。仅 /community/list 计算 */
  managedByMe?: boolean;
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

/** 圈子管理角色：圈主/管理员（P2-64 发岗免支付判定口径，与后端 payment.service 一致，最终以服务端为准） */
export function isCommunityManagerRole(role: CommunityVo['myRole'] | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * P2-70 该圈是否「我管理的圈子」（发岗免支付口径）：圈内圈主/管理员角色，
 * 或管理端分配的圈子管理员授权（/community/list 的 managedByMe，最终以服务端为准）。
 */
export function isCommunityManagedByMe(c: Pick<CommunityVo, 'myRole' | 'managedByMe'> | undefined): boolean {
  if (!c) return false;
  return isCommunityManagerRole(c.myRole) || c.managedByMe === true;
}

/** P2-64 发岗选圈整理结果：排序后列表 + picker 展示名（与列表按下标对齐）+ 是否圈子管理员 */
export interface JobCommunityPicker {
  list: CommunityVo[];
  names: string[];
  isCircleAdmin: boolean;
}

/**
 * P2-64/70 发岗选圈列表整理：
 * - 圈子管理员/圈主（圈内角色或管理端授权，见 isCommunityManagedByMe）：自己管理的圈子排前
 *   并标注「（免费发布）」，其余标「（付费发布）」，组内保持原顺序；
 * - 普通商家：原顺序、原名称（不加标签、不排序）。
 */
export function buildJobCommunityPicker(list: CommunityVo[]): JobCommunityPicker {
  if (!list.some((c) => isCommunityManagedByMe(c))) {
    return { list, names: list.map((c) => c.name), isCircleAdmin: false };
  }
  const sorted = [...list].sort(
    (a, b) => (isCommunityManagedByMe(a) ? 0 : 1) - (isCommunityManagedByMe(b) ? 0 : 1),
  );
  return {
    list: sorted,
    names: sorted.map((c) =>
      isCommunityManagedByMe(c) ? `${c.name}（免费发布）` : `${c.name}（付费发布）`
    ),
    isCircleAdmin: true,
  };
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
/** 生成圈子邀请小程序码（仅圈友可用） */
export interface CommunityInviteCodeVo {
  communityId: string;
  imageBase64: string;
  mimeType: 'image/png';
}
export function getCommunityInviteCode(id: string): Promise<CommunityInviteCodeVo> {
  return request<CommunityInviteCodeVo>({ url: `/community/${id}/invite-code` });
}

/** 创建圈子（creator → OWNER + 成员 + 置当前；category/region/location 必填）
 *  P2-26 返回 CreateCommunityResult 含 pending 标记，按此切 toast 文案 */
export function createCommunity(data: { name: string; logo?: string; backgroundImage?: string; description?: string; category: string; region: string; location: string }): Promise<CreateCommunityResult> {
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

/** 分享邀请幂等入圈：已是圈友时直接切换，不重复增加圈友数。 */
export function acceptCommunityInvite(id: string): Promise<{ id: string; joined: boolean }> {
  return request<{ id: string; joined: boolean }>({ url: `/community/${id}/invite-join`, method: 'POST' });
}

/** 退出圈子（圈主不可退） */
export function leaveCommunity(id: string): Promise<{ id: string }> {
  return request<{ id: string }>({ url: `/community/${id}/leave`, method: 'POST' });
}

/** 切换当前圈子（须已是成员） */
export function switchCommunity(id: string): Promise<{ id: string }> {
  return request<{ id: string }>({ url: '/community/switch', method: 'POST', data: { communityId: id } });
}

/** 广告位轮播（仅当前圈子 Banner） */
export function listBanners(communityId: string): Promise<BannerVo[]> {
  return request<BannerVo[]>({ url: `/square/banners?communityId=${encodeURIComponent(communityId)}` });
}
