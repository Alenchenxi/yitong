import { request } from './request';

export type FavoriteTargetType = 'post' | 'anon_post' | 'job_post';

export interface FavoriteVo {
  id: string;
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  targetAnonymous: boolean;
  createdAt: string;
}

export interface FavoriteListResult {
  list: FavoriteVo[];
  total: number;
  page: number;
  pageSize: number;
}

export function toggleFavorite(data: { targetType: FavoriteTargetType; targetId: string }) {
  return request<{ favorited: boolean; id?: string }>({
    url: '/favorites',
    method: 'POST',
    data,
  });
}

export function listFavorites(targetType?: FavoriteTargetType, page = 1, pageSize = 20) {
  const qs = `?${targetType ? `targetType=${targetType}&` : ''}page=${page}&pageSize=${pageSize}`;
  return request<FavoriteListResult>({ url: `/favorites${qs}` });
}

export async function listAllFavorites(targetType?: FavoriteTargetType): Promise<FavoriteVo[]> {
  const favorites: FavoriteVo[] = [];
  let page = 1;

  while (true) {
    const response = await listFavorites(targetType, page, 50);
    favorites.push(...response.list);
    if (
      response.list.length === 0
      || favorites.length >= response.total
      || response.list.length < response.pageSize
    ) {
      return favorites;
    }
    page += 1;
  }
}

export function checkFavorite(targetType: FavoriteTargetType, targetId: string) {
  return request<{ favorited: boolean; id?: string }>({
    url: `/favorites/check?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
  });
}

export function deleteFavorite(id: string) {
  return request<{ deleted: boolean }>({ url: `/favorites/${id}`, method: 'DELETE' });
}
