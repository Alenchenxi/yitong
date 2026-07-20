import { request } from './request';

// 表白墙接口类型（与后端 PostVo/CommentVo/FeedResult/PageResult 对齐）
export interface Circle {
  id: string;
  name: string;
  icon: string | null;
}

export interface PostVo {
  id: string;
  circleId: string;
  authorId: string;
  authorNickname: string;
  authorAvatarUrl: string | null;
  content: string;
  images: string[];
  likeCount: number;
  liked: boolean;
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

// 圈子
export function listCircles() {
  return request<Circle[]>({ url: '/circles' });
}

// 发帖
export function createPost(circleId: string, content: string, images: string[]) {
  return request<PostVo>({
    url: `/circles/${circleId}/posts`,
    method: 'POST',
    data: { content, images },
  });
}

// 圈子内帖子列表
export function listCirclePosts(circleId: string, cursor?: string, limit = 20) {
  const qs = `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return request<FeedResult>({ url: `/circles/${circleId}/posts${qs}` });
}

// 发现流（sort: latest 最新 / hot 热门 / recommend 推荐）
export function feed(cursor?: string, limit = 20, sort?: 'latest' | 'hot' | 'recommend') {
  const qs = `?limit=${limit}${sort ? `&sort=${sort}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  return request<FeedResult>({ url: `/posts/feed${qs}` });
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

// 评论
export function createComment(postId: string, content: string) {
  return request<CommentVo>({
    url: `/posts/${postId}/comments`,
    method: 'POST',
    data: { content },
  });
}

// 评论列表
export function listComments(postId: string, page = 1, pageSize = 20) {
  return request<PageResult<CommentVo>>({
    url: `/posts/${postId}/comments?page=${page}&pageSize=${pageSize}`,
  });
}

// 我的表白墙（当前用户发的帖）
export function listMyPosts() {
  return request<{ list: PostVo[] }>({ url: '/posts/mine' });
}
