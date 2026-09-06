import { request } from './request';
import { anonRequest } from './treehole';

export type NearbyChannel = 'confession' | 'treehole';

export interface NearbyPresenceVo {
  enabled: boolean;
  locatedAt: string | null;
}

export interface NearbyPersonVo {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  avatarText: string;
  following: boolean;
  distanceLabel: string;
}

interface PublicNearbyItem {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  following: boolean;
  distanceLabel: string;
}

interface AnonymousNearbyItem {
  anonId: string;
  nickname: string;
  avatar: string | null;
  following: boolean;
  distanceLabel: string;
}

interface NearbyListResult<T> {
  enabled: boolean;
  list: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

function queryString(cursor?: string, limit = 20): string {
  const params = ['limit=' + encodeURIComponent(String(limit))];
  if (cursor) params.push('cursor=' + encodeURIComponent(cursor));
  return params.join('&');
}

export function getNearbyPresence(channel: NearbyChannel): Promise<NearbyPresenceVo> {
  if (channel === 'treehole') {
    return anonRequest({ url: '/treehole/nearby-presence', method: 'GET' });
  }
  return request({ url: '/users/me/nearby-presence' });
}

export function enableNearbyPresence(
  channel: NearbyChannel,
  location: { lng: number; lat: number },
): Promise<NearbyPresenceVo> {
  if (channel === 'treehole') {
    return anonRequest({
      url: '/treehole/nearby-presence',
      method: 'PUT',
      data: location,
    });
  }
  return request({
    url: '/users/me/nearby-presence',
    method: 'PUT',
    data: location,
  });
}

export function disableNearbyPresence(channel: NearbyChannel): Promise<{ enabled: boolean }> {
  if (channel === 'treehole') {
    return anonRequest({ url: '/treehole/nearby-presence', method: 'DELETE' });
  }
  return request({ url: '/users/me/nearby-presence', method: 'DELETE' });
}

export async function listNearbyPeople(
  channel: NearbyChannel,
  cursor?: string,
  limit = 20,
): Promise<NearbyListResult<NearbyPersonVo>> {
  const query = queryString(cursor, limit);
  if (channel === 'treehole') {
    const response = await anonRequest<NearbyListResult<AnonymousNearbyItem>>({
      url: '/treehole/nearby?' + query,
      method: 'GET',
    });
    return {
      ...response,
      list: response.list.map((item) => ({
        id: item.anonId,
        nickname: item.nickname,
        avatarUrl: null,
        avatarText: item.avatar || '🌙',
        following: item.following,
        distanceLabel: item.distanceLabel,
      })),
    };
  }
  const response = await request<NearbyListResult<PublicNearbyItem>>({
    url: '/users/nearby?' + query,
  });
  return {
    ...response,
    list: response.list.map((item) => ({
      id: item.userId,
      nickname: item.nickname,
      avatarUrl: item.avatarUrl,
      avatarText: item.nickname.charAt(0) || '友',
      following: item.following,
      distanceLabel: item.distanceLabel,
    })),
  };
}
