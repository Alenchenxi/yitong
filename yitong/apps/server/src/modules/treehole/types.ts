// 树洞视图对象（后端）--供 square union feed 复用
// 红线：严禁包含 authorId / authorNickname / authorAvatarUrl / userId / uid 等真实身份字段
export interface AnonPostVo {
  id: string;
  anonId: string; // 树洞匿名 id，不含真实 uid
  platformPublished: boolean;
  content: string;
  images: string[];
  videoUrl: string | null; // P2-83 视频发布（与图片互斥）
  videoCover: string | null;
  mood: string | null;
  locationCity: string | null; // CR-006 发布地·市（纯展示文本；不存坐标——匿名红线）
  locationDistrict: string | null; // CR-006 发布地·区（地址无区县命中时 null）
  likeCount: number;
  liked: boolean; // 当前用户是否已赞；anonToken 缺失时为 false
  commentCount: number; // 评论数（动态 _count）
  viewCount: number; // 累计浏览数（PV），详情接口 fire-and-forget 自增
  boosted: boolean; // 内容推广：boostUntil > now 为 true
  boostUntil: string | null; // ISO 字符串，未推广为 null
  createdAt: string; // ISO 字符串
  updatedAt?: string; // CR-008 排序用更新时间（编辑时刷新；列表排序键）
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
