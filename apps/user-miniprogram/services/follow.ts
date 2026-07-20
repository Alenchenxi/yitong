import { request } from './request';

export function toggleFollow(userId: string) {
  return request<{ following: boolean }>({ url: `/users/${userId}/follow`, method: 'POST' });
}

export function checkFollowing(userId: string) {
  return request<{ following: boolean }>({ url: `/users/${userId}/following` });
}
