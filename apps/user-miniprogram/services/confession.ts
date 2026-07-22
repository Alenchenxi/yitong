import { request } from './request';

// 表白墙接口类型（与后端 PostVo/CommentVo/FeedResult/PageResult 对齐）
export interface Circle {
  id: string;
  name: string;
  icon: string | null;
}

export type PostVisibility = 'PUBLIC' | 'PRIVATE' | 'DRAFT';

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
  liked: boolean;
  commentCount: number;
  visibility: PostVisibility;
  createdAt: string;
  editedAt: string | null; // P1-10
}

export interface CreatePostPayload {
  content: string;
  images?: string[];
  tags?: string[];
  isAnonymous?: boolean;
  videoUrl?: string;
  videoCover?: string;
  visibility?: PostVisibility; // P1-11
}

export interface CommentVo {
  id: string;
  postId: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
  content: string;
  parentId: string | null; // P0-10 所属顶级评论；null=顶级评论
  replyToNickname: string | null; // P0-10 被回复用户昵称（"回复@user"）
  replies: CommentVo[]; // 顶级评论：预览回复（最多 3 条，时间升序）；回复：空
  replyCount: number; // P1-01 回复总数（顶级评论有效，回复恒为 0）
  likeCount: number; // P1-02 评论点赞数
  liked: boolean; // P1-02 当前用户是否已赞
  pinned: boolean; // P1-04 热评置顶
  createdAt: string;
}

// P1-02 评论点赞结果
export interface CommentLikeResult {
  liked: boolean;
  likeCount: number;
}

// P1-05 搜索帖子结果
export interface PostSearchResult { list: PostVo[]; }
// P1-06 搜索用户结果
export interface UserSearchItem { id: string; nickname: string; avatarUrl: string | null; }
export interface UserSearchResult { list: UserSearchItem[]; }
// P1-07 搜索话题/标签结果
export interface TagSearchItem { tag: string; postCount: number; }
export interface TagSearchResult { list: TagSearchItem[]; }
// P1-07 热搜词
export interface HotKeyword { keyword: string; count: number; }
export interface HotKeywordsResult { list: HotKeyword[]; }

// P1-01 跳转定位结果
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

// 圈子
export function listCircles() {
  return request<Circle[]>({ url: '/circles' });
}

// 发帖
export function createPost(circleId: string, payload: CreatePostPayload) {
  return request<PostVo>({
    url: `/circles/${circleId}/posts`,
    method: 'POST',
    data: {
      content: payload.content,
      images: payload.images,
      tags: payload.tags,
      isAnonymous: payload.isAnonymous,
      videoUrl: payload.videoUrl,
      videoCover: payload.videoCover,
      visibility: payload.visibility,
    },
  });
}

// 圈子内帖子列表
export function listCirclePosts(circleId: string, cursor?: string, limit = 20) {
  const qs = `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return request<FeedResult>({ url: `/circles/${circleId}/posts${qs}` });
}

// 发现流（sort: latest 最新 / hot 热门 / recommend 推荐 / follow 关注流）
export function feed(cursor?: string, limit = 20, sort?: 'latest' | 'hot' | 'recommend' | 'follow') {
  const qs = `?limit=${limit}${sort ? `&sort=${sort}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return request<FeedResult>({ url: `/posts/feed${qs}` });
}

// P2-01 置顶最热帖子（首页顶部横向滚动，全时段 top N）
export function listHotTop(limit = 10) {
  return request<{ list: PostVo[] }>({ url: `/posts/hot-top?limit=${limit}` });
}

// P2-02 今日上头（近 24h 最热，page 分页）
export function listTodayHit(page = 1, pageSize = 20) {
  return request<PageResult<PostVo>>({ url: `/posts/today-hit?page=${page}&pageSize=${pageSize}` });
}

// 帖子详情
export function getPost(id: string) {
  return request<PostVo>({ url: `/posts/${id}` });
}

// 点赞 toggle
export function toggleLike(postId: string) {
  return request<LikeResult>({ url: `/posts/${postId}/like`, method: 'POST' });
}

export function reportPost(postId: string, reason?: string) {
  return request({ url: `/posts/${postId}/report`, method: 'POST', data: { reason } });
}

// 评论（P0-10：opts.parentId 回复顶级评论；opts.replyToId 回复具体评论/回复）
export function createComment(
  postId: string,
  content: string,
  opts?: { parentId?: string; replyToId?: string },
) {
  return request<CommentVo>({
    url: `/posts/${postId}/comments`,
    method: 'POST',
    data: {
      content,
      parentId: opts?.parentId,
      replyToId: opts?.replyToId,
    },
  });
}

// 评论列表
export function listComments(postId: string, page = 1, pageSize = 20) {
  return request<PageResult<CommentVo>>({
    url: `/posts/${postId}/comments?page=${page}&pageSize=${pageSize}`,
  });
}

// P1-01 顶级评论的回复分页（时间升序）
export function listReplies(postId: string, commentId: string, page = 1, pageSize = 10) {
  return request<PageResult<CommentVo>>({
    url: `/posts/${postId}/comments/${commentId}/replies?page=${page}&pageSize=${pageSize}`,
  });
}

// P1-01 评论跳转定位（返回所属顶级评论与所在分页页码）
export function locateComment(postId: string, commentId: string, pageSize = 20) {
  return request<LocateResult>({
    url: `/posts/${postId}/comments/locate?commentId=${encodeURIComponent(commentId)}&pageSize=${pageSize}`,
  });
}

// P1-10 编辑帖子（PUT）
export function editPost(postId: string, payload: CreatePostPayload) {
  return request<PostVo>({
    url: `/posts/${postId}`,
    method: 'PUT',
    data: {
      content: payload.content,
      images: payload.images,
      tags: payload.tags,
      isAnonymous: payload.isAnonymous,
      videoUrl: payload.videoUrl,
      videoCover: payload.videoCover,
      visibility: payload.visibility,
    },
  });
}

// P1-10 删除帖子（软删）
export function deletePost(postId: string) {
  return request<{ deleted: boolean }>({ url: `/posts/${postId}`, method: 'DELETE' });
}

// 我的表白墙（当前用户发的帖）
export function listMyPosts() {
  return request<{ list: PostVo[] }>({ url: '/posts/mine' });
}

// P1-11 我的草稿 / 私密
export function listMyDrafts(page = 1, pageSize = 20) {
  return request<PageResult<PostVo>>({ url: `/posts/mine/drafts?page=${page}&pageSize=${pageSize}` });
}
export function listMyPrivate(page = 1, pageSize = 20) {
  return request<PageResult<PostVo>>({ url: `/posts/mine/private?page=${page}&pageSize=${pageSize}` });
}

// P1-08 我点赞的帖
export function listMyLikedPosts(page = 1, pageSize = 20) {
  return request<PageResult<PostVo>>({ url: `/posts/mine/liked?page=${page}&pageSize=${pageSize}` });
}
// P1-08 我评论过的帖
export function listMyCommentedPosts(page = 1, pageSize = 20) {
  return request<PageResult<PostVo>>({ url: `/posts/mine/commented?page=${page}&pageSize=${pageSize}` });
}

// P1-02 评论点赞 toggle
export function toggleCommentLike(commentId: string) {
  return request<CommentLikeResult>({ url: `/comments/${commentId}/like`, method: 'POST' });
}

// P1-05/06/07 搜索：帖子 / 用户 / 话题 / 热搜词
export function searchPosts(q: string, limit = 20) {
  return request<PostSearchResult>({
    url: `/posts/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  });
}
export function searchUsers(q: string, limit = 20) {
  return request<UserSearchResult>({
    url: `/users/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  });
}
export function searchTags(q: string, limit = 20) {
  return request<TagSearchResult>({
    url: `/tags/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  });
}
export function hotKeywords() {
  return request<HotKeywordsResult>({ url: '/search/hot' });
}
