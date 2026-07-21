import { request } from './request';

export function toggleFollow(userId: string) {
  return request<{ following: boolean }>({ url: `/users/${userId}/follow`, method: 'POST' });
}

export function checkFollowing(userId: string) {
  return request<{ following: boolean }>({ url: `/users/${userId}/following` });
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
