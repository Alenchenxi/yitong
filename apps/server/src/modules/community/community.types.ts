// 圈子（Community）VO 定义
// 说明：圈子是「用户可加入/创建/切换」的社区（非表白墙发帖分类 Circle）。

export type CommunityStatusVo = 'ACTIVE' | 'DISABLED' | 'PENDING'; // P2-26 加 PENDING
export type CommunityRoleVo = 'OWNER' | 'ADMIN' | 'MEMBER';

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
  status: CommunityStatusVo;
  /** P2-26 拒绝原因（仅 DISABLED-from-rejected 圈有值） */
  rejectReason: string | null;
  isMember: boolean;
  myRole: CommunityRoleVo | null;
  createdAt: string;
}

export interface CommunityMineResult {
  activeId: string | null;
  list: CommunityVo[];
}

/** P2-26 creator 视角「我的全部圈子」分桶结果 */
export interface CommunityMineAllResult {
  activeId: string | null;
  /** status=ACTIVE 的我创圈（含通过后的我自己 + 我加入的常规圈） */
  joined: CommunityVo[];
  /** status=PENDING 的我创圈（待审核，自己可见） */
  pending: CommunityVo[];
  /** status=DISABLED 且 rejectReason 非空 的我创圈（被拒） */
  rejected: CommunityVo[];
}

/** P2-26 创建圈子的返回（CommunityVo + pending 标记，用于前端切 toast） */
export interface CreateCommunityResult extends CommunityVo {
  pending: boolean;
}

/** 分享邀请入圈：joined=true 表示本次新加入，false 表示原本已是圈友。 */
export interface CommunityInviteResult {
  id: string;
  joined: boolean;
}

export interface BannerVo {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
}

// 今日上头：近24h 浏览量 TopN 聚合结果（kind: 'post' | 'anon_post'）
export interface TodayHotItem {
  targetType: 'post' | 'anon_post';
  targetId: string;
  viewCount: number;
}
