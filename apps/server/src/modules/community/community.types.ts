// 圈子（Community）VO 定义
// 说明：圈子是「用户可加入/创建/切换」的社区（非表白墙发帖分类 Circle）。

export type CommunityStatusVo = 'ACTIVE' | 'DISABLED';
export type CommunityRoleVo = 'OWNER' | 'ADMIN' | 'MEMBER';

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
  status: CommunityStatusVo;
  isMember: boolean;
  myRole: CommunityRoleVo | null;
  createdAt: string;
}

export interface CommunityMineResult {
  activeId: string | null;
  list: CommunityVo[];
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
