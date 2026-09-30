// 岗位地点本地服务(P2-79 去百度地图):坐标转换 + 城市解析 + 区县列表,全部离线计算,无外部 API / AK。
// 坐标契约:入参 GCJ-02(微信 wx.chooseLocation / wx.getFuzzyLocation 返回系),存储 BD-09(与存量岗位一致,零数据迁移)。

import { Injectable } from '@nestjs/common';
import areas = require('@province-city-china/area');
import cities = require('@province-city-china/city');
import provinces = require('@province-city-china/province');

// GCJ-02 → BD-09 确定性公式(即百度 geoconv from=3 to=5 的定义本身,实测 4 组锚值误差 0 / 往返 <0.1m)
const X_PI = (Math.PI * 3000) / 180;

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function normalizeName(name: string): string {
  return name.trim().replace(/(特别行政区|自治州|自治县|地区|市|盟)$/u, '');
}

interface CityNeedle {
  needle: string; // 归一化城市名(去「市/自治州/地区/盟」后缀),includes 匹配用
  official: string; // 官方全名(「杭州市」),解析命中返回它
  province: string; // 省级行政区码,同名城市省名消歧用
}

// 省名消歧表:needle 在城市名归一基础上再剥「省」尾(「河北省」→「河北」,提高预匹配命中率)
const PROVINCE_NEEDLES: Array<{ needle: string; province: string }> = provinces
  .map((item) => ({ needle: normalizeName(item.name).replace(/省$/u, ''), province: item.province }))
  .filter((item) => item.needle.length > 0);

// 模块级静态表:全量 337 地级市 + 4 直辖市(cities 数据不含直辖市,从 provinces 补),按 needle 长度降序
const CITY_NEEDLES: CityNeedle[] = [
  ...provinces
    .filter((item) => ['11', '12', '31', '50'].includes(item.province))
    .map((item) => ({ needle: normalizeName(item.name), official: item.name, province: item.province })),
  ...cities.map((item) => ({ needle: normalizeName(item.name), official: item.name, province: item.province })),
].sort((a, b) => b.needle.length - a.needle.length);

@Injectable()
export class LocationService {
  // GCJ-02(微信系) → BD-09(存储系);round6 对齐 Decimal(10,6),保证幂等重放一致
  gcj02ToBd09(lng: number, lat: number): { lng: number; lat: number } {
    const x = lng;
    const y = lat;
    const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * X_PI);
    return {
      lng: round6(z * Math.cos(theta) + 0.0065),
      lat: round6(z * Math.sin(theta) + 0.006),
    };
  }

  normalizeAdministrativeName(name: string): string {
    return normalizeName(name);
  }

  // 从地址文本解析城市:needle 长度降序 includes,取最长命中;同名城市先用省名预匹配消歧,
  // 仍不唯一取表序第一(确定性)。返回官方全名(「杭州市」),无命中 → null。
  // 已知限制:跨市同名街区可能误判(如「中山路」命中中山市),只影响 city 归类不影响坐标。
  parseCityFromAddress(address: string | null | undefined): string | null {
    const text = (address ?? '').trim();
    if (!text) return null;
    // 省名预匹配:地址含某省名 → 后续只在该省内找城市(消「吉林省吉林市」式歧义)
    const matchedProvince = PROVINCE_NEEDLES.find((p) => p.needle.length >= 2 && text.includes(p.needle));
    const hit = CITY_NEEDLES.find(
      (c) => text.includes(c.needle) && (!matchedProvince || c.province === matchedProvince.province),
    );
    return hit ? hit.official : null;
  }

  // 指定城市的全量区县列表(本地包数据,无岗区县也可作筛选项)
  listDistricts(cityName: string, adcode?: string): string[] {
    const normalizedCity = this.normalizeAdministrativeName(cityName);
    const normalizedAdcode = adcode ? String(adcode) : '';
    let provinceCode = normalizedAdcode.slice(0, 2);
    let cityCode = normalizedAdcode.slice(2, 4);

    const city = cities.find((item) => this.normalizeAdministrativeName(item.name) === normalizedCity);
    if (city) {
      provinceCode = city.province;
      cityCode = city.city;
    } else {
      const municipality = provinces.find(
        (item) => this.normalizeAdministrativeName(item.name) === normalizedCity,
      );
      if (municipality) {
        return areas
          .filter((item) => item.province === municipality.province)
          .map((item) => item.name)
          .filter((name, index, list) => list.indexOf(name) === index);
      }
    }

    if (!provinceCode || !cityCode) return [];
    return areas
      .filter((item) => item.province === provinceCode && item.city === cityCode)
      .map((item) => item.name)
      .filter((name, index, list) => list.indexOf(name) === index);
  }
}
