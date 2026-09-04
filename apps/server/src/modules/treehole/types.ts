// 树洞视图对象（后端）--供 square union feed 复用
// 红线：严禁包含 authorId / authorNickname / authorAvatarUrl / userId / uid 等真实身份字段
export interface AnonPostVo {
  id: string;
  anonId: string; // 树洞匿名 id，不含真实 uid
  platformPublished: boolean;
  content: string;
  images: string[];
  mood: string | null;
  likeCount: number;
  liked: boolean; // 当前用户是否已赞；anonToken 缺失时为 false
  commentCount: number; // 评论数（动态 _count）
  viewCount: number; // 累计浏览数（PV），详情接口 fire-and-forget 自增
  boosted: boolean; // 内容推广：boostUntil > now 为 true
  boostUntil: string | null; // ISO 字符串，未推广为 null
  createdAt: string; // ISO 字符串
}

// 树洞匿名评论 VO（红线：authorAnonId 是匿名 id，不含真实 uid）
export interface AnonCommentVo {
  id: string;
  postId: string;
  authorAnonId: string; // 评论者匿名 id（0 真实 uid）
  content: string;
  likeCount: number;
  liked: boolean; // 当前匿名态是否已赞
  isLZ: boolean; // 楼主标记：authorAnonId === post.anonId
  createdAt: string; // ISO 字符串
}
