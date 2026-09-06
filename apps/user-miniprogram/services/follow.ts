import { request } from './request';
import type { PageResult, PostVo } from './confession';

export function toggleFollow(userId: string) {
  return request<{ following: boolean }>({ url: `/users/${userId}/follow`, method: 'POST' });
}

export function checkFollowing(userId: string) {
  return request<{ following: boolean }>({ url: `/users/${userId}/following` });
}

export interface UserProfileVo {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  isSelf: boolean;
  following: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  posts: PageResult<PostVo>;
}

export function getUserProfile(userId: string, page = 1, pageSize = 20) {
  return request<UserProfileVo>({
    url: `/users/${encodeURIComponent(userId)}/profile?page=${page}&pageSize=${pageSize}`,
  });
}

// P1-09 关注/粉丝列表项
export interface FollowUserItem {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  followedAt: string;
}
export interface FollowListResult {
  list: FollowUserItem[];
  total: number;
  page: number;
  pageSize: number;
}

// P1-09 我的关注列表
export function myFollowing(page = 1, pageSize = 30) {
  return request<FollowListResult>({ url: `/users/me/following?page=${page}&pageSize=${pageSize}` });
}
// P1-09 我的粉丝列表
export function myFollowers(page = 1, pageSize = 30) {
  return request<FollowListResult>({ url: `/users/me/followers?page=${page}&pageSize=${pageSize}` });
}
