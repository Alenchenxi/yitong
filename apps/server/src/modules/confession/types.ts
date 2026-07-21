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
  replies: CommentVo[]; // 顶级评论：预览回复（最多 3 条，时间升序）；回复：空数组
  replyCount: number; // P1-01 回复总数（顶级评论有效，回复恒为 0）
  likeCount: number; // P1-02 评论点赞数
  liked: boolean; // P1-02 当前用户是否已赞
  pinned: boolean; // P1-04 热评置顶（true=被自动/人工置顶）
  createdAt: string;
}

// P1-01 跳转定位：目标评论所属顶级评论 + 其在顶级分页中的页码
export interface LocateResult {
  threadRootId: string;
  page: number;
  pageSize: number;
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
