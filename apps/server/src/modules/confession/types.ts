// 表白墙视图对象（脱去内部字段，时间转 ISO 字符串）
export interface PostVo {
  id: string;
  circleId: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
  content: string;
  images: string[];
  likeCount: number;
  liked: boolean; // 当前用户是否已赞
  commentCount: number;
  createdAt: string;
}

export interface CommentVo {
  id: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
}

export interface FeedResult {
  list: PostVo[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}
