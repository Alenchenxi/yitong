import { request } from './request';

export interface PoiInfoVo {
  poiId: string;
  address: string;
  lng: number;
  lat: number;
  city: string;
}

// 百度地图 place suggestion 候选搜索(GET /job-posts/place-suggestion)
// 用于发布岗位工作地点搜索框的实时候选列表
export function suggestPlaces(query: string, region?: string) {
  const params = `query=${encodeURIComponent(query)}` + (region ? `&region=${encodeURIComponent(region)}` : '');
  return request<PoiInfoVo[]>({ url: `/job-posts/place-suggestion?${params}` });
}
