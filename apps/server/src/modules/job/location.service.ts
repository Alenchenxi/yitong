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
}