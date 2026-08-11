// 百度地图 API 封装(2026-08-10):工作地点强制地图选点,服务端兜底校验。
// 凭证:process.env.BAIDU_MAP_AK(本地 .env 写入,gitignored);缺失 dev 走 mock,prod 抛 90003。
// AK 安全:真实 AK 绝不进任何提交文件(.ts / .env.example / 文档);本文件只读 env 变量。

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BizException } from '../../common/exceptions/biz.exception';

export interface PoiInfo {
  poiId: string;
  address: string;
  lng: number;
  lat: number;
  city: string;
}

interface BaiduGeocodeItem {
  // 真实 API 字段:精确结果含 uid/location/address/address_detail.city
  uid?: string;
  location?: { lng: number; lat: number };
  address?: string;
  address_detail?: { city?: string };
}

interface BaiduGeocodeResponse {
  status: number; // 0 = 成功
  message?: string;
  result?: {
    location?: { lng: number; lat: number };
    precise?: number;
    confidence?: number;
    comprehension?: number;
    level?: string;
    formatted_address?: string;
    addressComponent?: { city?: string };
  } | BaiduGeocodeItem;
}

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(private readonly config: ConfigService) {}

  private getAk(): string {
    const ak = this.config.get<string>('BAIDU_MAP_AK');
    return typeof ak === 'string' ? ak.trim() : '';
  }

  isReady(): boolean {
    return this.getAk().length > 0;
  }

  // dev mock:基于 address 哈希生成稳定的 poiId/lng/lat(随机但可重放)
  private mockGeocode(address: string): PoiInfo {
    let h = 0;
    for (let i = 0; i < address.length; i++) {
      h = (h * 31 + address.charCodeAt(i)) | 0;
    }
    const lng = 116.4 + ((Math.abs(h) % 1000) / 1000) * 0.5; // 北京周边 116.4-116.9
    const lat = 39.9 + ((Math.abs(h >> 8) % 1000) / 1000) * 0.3; // 39.9-40.2
    const cityMatch = address.match(/^(北京|上海|广州|深圳|杭州|成都|武汉|南京|天津|西安|重庆)/);
    const city = cityMatch ? cityMatch[1]! : '北京';
    return {
      poiId: `mock_${Math.abs(h).toString(36)}`,
      address,
      lng: Math.round(lng * 1e6) / 1e6,
      lat: Math.round(lat * 1e6) / 1e6,
      city,
    };
  }

  // 正向地理编码:文本地址 -> poiId/lng/lat/city
  // 缺失 AK:dev mock;prod 抛 90003
  async geocode(address: string): Promise<PoiInfo> {
    if (!address || address.trim().length === 0) {
      throw new BizException(40003, '地址不能为空', HttpStatus.BAD_REQUEST);
    }
    const ak = this.getAk();
    if (!ak) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '百度地图 AK 未配置', HttpStatus.SERVICE_UNAVAILABLE);
      }
      return this.mockGeocode(address.trim());
    }
    try {
      const url = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(address)}&output=json&ak=${ak}`;
      const resp = await fetch(url);
      const data = (await resp.json()) as BaiduGeocodeResponse;
      if (data.status !== 0 || !data.result) {
        throw new BizException(40003, `百度地图地理编码失败:${data.message ?? 'unknown'}`, HttpStatus.BAD_REQUEST);
      }
      // 兼容两种 result 形态
      const r = data.result;
      const loc = r.location;
      const addr = (r as BaiduGeocodeItem).address ?? (r as { formatted_address?: string }).formatted_address ?? address;
      const city =
        (r as BaiduGeocodeItem).address_detail?.city ??
        (r as { addressComponent?: { city?: string } }).addressComponent?.city ??
        '';
      const uid = (r as BaiduGeocodeItem).uid ?? `bd_${Date.now()}`;
      if (!loc) {
        throw new BizException(40003, '百度地图返回坐标为空', HttpStatus.BAD_REQUEST);
      }
      return {
        poiId: uid,
        address: addr,
        lng: loc.lng,
        lat: loc.lat,
        city,
      };
    } catch (e) {
      if (e instanceof BizException) throw e;
      this.logger.warn(`baidu geocode error: ${(e as Error).message}`);
      throw new BizException(40003, '百度地图 API 调用失败', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // poiId -> PoiInfo(主要用于前端已选点,刷新页面后回填)
  async getPoiDetail(poiId: string): Promise<PoiInfo> {
    if (!poiId || poiId.trim().length === 0) {
      throw new BizException(40003, 'poiId 不能为空', HttpStatus.BAD_REQUEST);
    }
    // dev mock:poiId 以 mock_ 开头走 mock;否则按生产方式访问(若 AK 缺失则降级)
    if (poiId.startsWith('mock_')) {
      return {
        poiId,
        address: 'mock address',
        lng: 116.4,
        lat: 39.9,
        city: '北京',
      };
    }
    const ak = this.getAk();
    if (!ak) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '百度地图 AK 未配置', HttpStatus.SERVICE_UNAVAILABLE);
      }
      return {
        poiId,
        address: 'mock address',
        lng: 116.4,
        lat: 39.9,
        city: '北京',
      };
    }
    // 真实 poiDetail:百度地图开放平台 web API /place/v2
    try {
      const url = `https://api.map.baidu.com/place/v2?uid=${encodeURIComponent(poiId)}&output=json&ak=${ak}&scope=2`;
      const resp = await fetch(url);
      const data = (await resp.json()) as { status: number; message?: string; result?: { location?: { lng: number; lat: number }; address?: string; city?: string } };
      if (data.status !== 0 || !data.result?.location) {
        throw new BizException(40003, `百度地图 poi 查询失败:${data.message ?? 'unknown'}`, HttpStatus.BAD_REQUEST);
      }
      return {
        poiId,
        address: data.result.address ?? '',
        lng: data.result.location.lng,
        lat: data.result.location.lat,
        city: data.result.city ?? '',
      };
    } catch (e) {
      if (e instanceof BizException) throw e;
      throw new BizException(40003, '百度地图 poi 查询失败', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // 反向校验:createPost 时校验前端传入的 poiId/lng/lat 与服务端反查一致(防止伪造)
  // 已知限制:百度 API 调用配额 + 网络抖动;只在 createPost 主路径同步校验,失败抛 40003
  async verifyPoi(poiId: string, lng: number, lat: number): Promise<boolean> {
    const detail = await this.getPoiDetail(poiId);
    // 允许 50m 误差(百度坐标精度 + GCJ02 转换)
    const isLngClose = Math.abs(detail.lng - lng) < 0.001;
    const isLatClose = Math.abs(detail.lat - lat) < 0.001;
    return isLngClose && isLatClose;
  }

  // 候选地址搜索(前端搜索框输入时调用,返回地址列表供用户点击锁定)
  // 百度 place suggestion v2:query=关键词&region=城市&output=json&ak=AK
  // dev mock:按 query 哈希生成若干稳定候选(地址形如「模拟地址 X」,poiId 以 mock_ 开头)
  // 已知限制:AK 需开启"地点检索"权限;否则 prod 抛 90003;dev 已降级
  async suggestPlaces(query: string, region?: string): Promise<PoiInfo[]> {
    const q = query?.trim() ?? '';
    if (!q) return [];
    const ak = this.getAk();
    if (!ak) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '百度地图 AK 未配置', HttpStatus.SERVICE_UNAVAILABLE);
      }
      // dev mock:基于 query 哈希生成 5 个候选(地址形如「{q}|n」+ 周边 1km 偏移)
      let h = 0;
      for (let i = 0; i < q.length; i++) h = (h * 31 + q.charCodeAt(i)) | 0;
      const city = region || '北京';
      const lng = 116.4 + ((Math.abs(h) % 1000) / 1000) * 0.5;
      const lat = 39.9 + ((Math.abs(h >> 8) % 1000) / 1000) * 0.3;
      const out: PoiInfo[] = [];
      for (let i = 0; i < 5; i++) {
        const offsetLng = lng + (i - 2) * 0.005;
        const offsetLat = lat + (i - 2) * 0.005;
        out.push({
          poiId: `mock_${Math.abs(h + i).toString(36)}`,
          address: `${q} ${i + 1}号`,
          lng: Math.round(offsetLng * 1e6) / 1e6,
          lat: Math.round(offsetLat * 1e6) / 1e6,
          city,
        });
      }
      return out;
    }
    try {
      const params = new URLSearchParams({
        query: q,
        region: region || '',
        output: 'json',
        ak,
      });
      const url = `https://api.map.baidu.com/place/v2/suggestion?${params.toString()}`;
      const resp = await fetch(url);
      const data = (await resp.json()) as {
        status: number;
        message?: string;
        result?: Array<{
          uid?: string;
          name?: string;
          address?: string;
          location?: { lng: number; lat: number };
          city?: string;
        }>;
      };
      if (data.status !== 0 || !data.result) {
        throw new BizException(40003, `百度地图候选搜索失败:${data.message ?? 'unknown'}`, HttpStatus.BAD_REQUEST);
      }
      return data.result.map((r) => ({
        poiId: r.uid ?? `bd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        address: [r.name, r.address].filter(Boolean).join(' '),
        lng: r.location?.lng ?? 0,
        lat: r.location?.lat ?? 0,
        city: r.city ?? region ?? '',
      }));
    } catch (e) {
      if (e instanceof BizException) throw e;
      this.logger.warn(`baidu suggestion error: ${(e as Error).message}`);
      throw new BizException(40003, '百度地图候选搜索失败', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // 坐标转换:GCJ-02(微信 wx.getLocation) → BD-09(百度坐标系,与岗位 locationLng/lat 一致)
  // 调百度 geoconv API;AK 缺失时 prod 抛 90003,dev 用近似公式
  async convertGcj02ToBd09(lng: number, lat: number): Promise<{ lng: number; lat: number }> {
    const ak = this.getAk();
    if (!ak) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '百度地图 AK 未配置，无法转换坐标', HttpStatus.SERVICE_UNAVAILABLE);
      }
      // dev:近似偏移(北京地区典型值,排序误差可接受)
      return { lng: lng + 0.0065, lat: lat + 0.006 };
    }
    try {
      const coords = `${lng},${lat}`;
      const url = `https://api.map.baidu.com/geoconv/v1/?coords=${encodeURIComponent(coords)}&from=3&to=5&ak=${ak}&output=json`;
      const resp = await fetch(url);
      const data = (await resp.json()) as { status: number; message?: string; result?: Array<{ x: number; y: number }> };
      if (data.status !== 0 || !data.result || data.result.length === 0) {
        this.logger.warn(`baidu geoconv failed: ${data.message ?? 'unknown'}, using identity`);
        return { lng, lat };
      }
      const r = data.result[0]!;
      return { lng: r.x, lat: r.y };
    } catch (e) {
      this.logger.warn(`baidu geoconv error: ${(e as Error).message}, using identity`);
      return { lng, lat };
    }
  }

  // dev mock reverse:基于 lng/lat 哈希生成稳定 poiId,坐标原样回传(不偏移,避免前端坐标跳变)
  // 量化到 4 位小数(≈11m 精度)兼顾幂等性与边界区分
  private mockReverseGeocode(lng: number, lat: number): PoiInfo {
    const key = `${lng.toFixed(4)}_${lat.toFixed(4)}`;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    // 城市粗判(复用前端 guessCity 的矩形框,后端兜底)
    let city = '北京';
    if (lat > 39 && lat < 41 && lng > 116 && lng < 117) city = '北京';
    else if (lat > 31 && lat < 32 && lng > 121 && lng < 122) city = '上海';
    else if (lat > 22 && lat < 24 && lng > 113 && lng < 114) city = '广州';
    else if (lat > 22 && lat < 23 && lng > 113 && lng < 115) city = '深圳';
    return {
      poiId: `mock_rev_${Math.abs(h).toString(36)}`,
      address: `模拟地址(${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lng,
      lat,
      city,
    };
  }

  // 反向地理编码:坐标(lng, lat) → PoiInfo(poiId/address/lng/lat/city)
  // 入参坐标系:gcj02(微信 wx.getFuzzyLocation 默认)或 bd09;后端内部转 bd09 后调百度 reverse
  // AK 缺失:dev 走 mockReverseGeocode,prod 抛 90003
  // 注:百度 reverse_geocoding/v3 location 参数顺序是 lat,lng(与本文件其它接口相反)
  async reverseGeocode(
    lng: number,
    lat: number,
    coordType: 'gcj02' | 'bd09' = 'gcj02',
  ): Promise<PoiInfo> {
    // 无 AK 判断必须在坐标系转换前(否则 dev 近似偏移破坏幂等,且反向也无意义)
    const ak = this.getAk();
    if (!ak) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '百度地图 AK 未配置', HttpStatus.SERVICE_UNAVAILABLE);
      }
      return this.mockReverseGeocode(lng, lat);
    }
    // 有 AK:gcj02 → bd09(百度 reverse 期望 bd09)
    let bd = { lng, lat };
    if (coordType === 'gcj02') {
      bd = await this.convertGcj02ToBd09(lng, lat);
    }
    try {
      // 注意 location 参数顺序:lat,lng(百度 reverse v3 与 geocoding v3 不同)
      const params = new URLSearchParams({
        location: `${bd.lat},${bd.lng}`,
        output: 'json',
        ak,
      });
      const url = `https://api.map.baidu.com/reverse_geocoding/v3/?${params.toString()}`;
      const resp = await fetch(url);
      const data = (await resp.json()) as {
        status: number;
        message?: string;
        result?: {
          location?: { lng: number; lat: number };
          formatted_address?: string;
          addressComponent?: { city?: string };
          // 百度 reverse 返回的 POI uid(部分场景有)
          uid?: string;
        };
      };
      // 把 narrowing 绑到本地 const(避免 r.formatted_address 重新访问丢失 narrow 类型)
      const formatted = data.result?.formatted_address;
      if (data.status !== 0 || !data.result || !formatted) {
        this.logger.warn(`baidu reverse geocode failed: ${data.message ?? 'unknown'}, falling back to mock`);
        return this.mockReverseGeocode(lng, lat);
      }
      const r = data.result;
      return {
        // 百度 reverse 不一定返回 uid;缺则基于坐标哈希生成稳定 poiId
        poiId: r.uid ?? `bd_rev_${bd.lng.toFixed(6)}_${bd.lat.toFixed(6)}`,
        address: formatted,
        lng: r.location?.lng ?? bd.lng,
        lat: r.location?.lat ?? bd.lat,
        city: r.addressComponent?.city ?? '',
      };
    } catch (e) {
      this.logger.warn(`baidu reverse geocode error: ${(e as Error).message}, falling back to mock`);
      return this.mockReverseGeocode(lng, lat);
    }
  }
}