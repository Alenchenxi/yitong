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

// 百度地图反向地理编码(GET /job-posts/reverse-geocode)
// 用于发布岗位"模糊定位成功后自动锁定默认选点";失败需静默降级(silent: true),让用户无感
export function reverseGeocode(lng: number, lat: number) {
  return request<PoiInfoVo>({ url: `/job-posts/reverse-geocode?lng=${lng}&lat=${lat}`, silent: true });
}
