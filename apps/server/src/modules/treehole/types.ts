// 树洞视图对象（后端）--供 square union feed 复用
// 红线：严禁包含 authorId / authorNickname / authorAvatarUrl / userId / uid 等真实身份字段
export interface AnonPostVo {
  id: string;
  anonId: string; // 树洞匿名 id，不含真实 uid
  content: string;
  images: string[];
  mood: string | null;
  likeCount: number;
  liked: boolean; // 当前用户是否已赞；anonToken 缺失时为 false
  boosted: boolean; // 内容推广：boostUntil > now 为 true
  boostUntil: string | null; // ISO 字符串，未推广为 null
  createdAt: string; // ISO 字符串
}
