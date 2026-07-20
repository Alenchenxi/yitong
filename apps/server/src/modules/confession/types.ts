// 表白墙视图对象（脱去内部字段，时间转 ISO 字符串）
// 匿名帖：authorId 置空、authorNickname=anonName、authorAvatarUrl=null（真实 uid 仅后台可追溯）
export interface PostVo {
  id: string;
  circleId: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
  content: string;
  images: string[];
  tags: string[];
  isAnonymous: boolean;
  videoUrl: string | null;
  videoCover: string | null;
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
  parentId: string | null; // P0-10 所属顶级评论；null=顶级评论
  replyToNickname: string | null; // P0-10 被回复用户昵称（"回复@user"展示）；null=回复顶级评论作者或顶级评论本身
  replies: CommentVo[]; // P0-10 子回复（顶级评论按时间升序填充，回复为空数组）
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
