import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const miniprogram = new URL('../../user-miniprogram/', import.meta.url);

const [
  controllerTs,
  locationServiceTs,
  jobServiceTs,
  jobDtoTs,
  jobPageTs,
  jobPageWxml,
  jobPageWxss,
  jobClientTs,
  chooseLocationTs,
] = await Promise.all([
  readFile(new URL('../src/modules/job/job.controller.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/job/location.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/job/job.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/job/dto/job.dto.ts', import.meta.url), 'utf8'),
  readFile(new URL('pages/job/index.ts', miniprogram), 'utf8'),
  readFile(new URL('pages/job/index.wxml', miniprogram), 'utf8'),
  readFile(new URL('pages/job/index.wxss', miniprogram), 'utf8'),
  readFile(new URL('services/job.ts', miniprogram), 'utf8'),
  readFile(new URL('utils/choose-location.ts', miniprogram), 'utf8'),
]);

assert(
  controllerTs.includes("@Get('job-posts/location-facets')") &&
    controllerTs.includes('this.job.getLocationFacets'),
  '服务端应提供有岗城市聚合 + 区县列表的 location-facets 接口',
);
assert(
  locationServiceTs.includes('@province-city-china/city') &&
    locationServiceTs.includes('parseCityFromAddress') &&
    locationServiceTs.includes('gcj02ToBd09') &&
    !locationServiceTs.includes('baidu'),
  '定位服务应为纯本地实现：本地公式转 BD-09 + 地址解析城市 + 行政区划数据区县',
);
assert(
  jobDtoTs.includes('export class JobRecommendQueryDto') &&
    jobDtoTs.includes('@IsIn([...SETTLEMENT_VALUES])') &&
    jobDtoTs.includes('location?: string') &&
    jobDtoTs.includes('city?: string'),
  '推荐接口应使用受校验的地点与结算方式查询参数',
);
assert(
  controllerTs.includes('async recommend(@Query() q: JobRecommendQueryDto') &&
    controllerTs.includes('this.job.recommend(uid, q)'),
  '推荐控制器应透传筛选参数',
);
assert(
  jobServiceTs.includes('async recommend(uid: string, q: JobRecommendQueryDto)') &&
    jobServiceTs.includes('where.settlement') &&
    jobServiceTs.includes('where.location') &&
    jobServiceTs.includes('where.locationCity'),
  '推荐候选池应应用结算方式与地点筛选',
);

assert(
  jobClientTs.includes('export function getLocationFacets') &&
    jobClientTs.includes('/job-posts/location-facets'),
  '小程序应封装有岗城市 facets 请求',
);
assert(
  chooseLocationTs.includes('wx.chooseLocation') &&
    chooseLocationTs.includes('ChosenLocation'),
  '小程序应共用微信原生地图选点封装（utils/choose-location.ts）',
);
assert(
  jobClientTs.includes('export interface JobRecommendFilter') &&
    jobClientTs.includes('appendDiscoveryFilterParams') &&
    jobClientTs.includes('filter.settlement') &&
    jobClientTs.includes('filter.location') &&
    jobClientTs.includes('filter.city'),
  '推荐请求应支持地点与结算方式参数',
);
assert(
  jobPageTs.includes("filterSection: 'district'") &&
    jobPageTs.includes('draftDistrict') &&
    jobPageTs.includes('appliedDistrict') &&
    jobPageTs.includes('draftSettlement') &&
    jobPageTs.includes('appliedSettlement'),
  '筛选面板应区分草稿状态与已应用状态',
);
assert(
  jobPageTs.includes('openFilter') &&
    jobPageTs.includes('resetFilter') &&
    jobPageTs.includes('applyFilter') &&
    jobPageTs.includes('closeFilter'),
  '筛选面板应支持打开、重置、确定和关闭',
);
assert(
  jobPageTs.includes('location: this.data.appliedDistrict || undefined') &&
    jobPageTs.includes('city: this.data.appliedCity || undefined') &&
    jobPageTs.includes('settlement: this.data.appliedSettlement || undefined'),
  '普通列表和推荐列表应使用已应用的城市/区域与结算方式筛选',
);
assert(
  jobPageTs.includes('cityOptions') &&
    jobPageTs.includes('loadCityFacets') &&
    jobPageTs.includes('selectCity') &&
    jobPageTs.includes('draftCity') &&
    jobPageTs.includes('appliedCity'),
  '筛选面板应从 facets 加载有岗城市并维护草稿/已应用城市状态（不依赖定位）',
);
assert(
  jobPageWxml.includes('筛选') &&
    jobPageWxml.includes('工作区域') &&
    jobPageWxml.includes('结算方式') &&
    jobPageWxml.includes('重置') &&
    jobPageWxml.includes('确定'),
  '兼职首页应呈现完整筛选入口和筛选面板',
);
assert(
  jobPageWxml.includes('catchtap="noop"') &&
    jobPageWxml.includes('bindtap="closeFilter"'),
  '筛选面板应阻止点击穿透，并允许遮罩或关闭按钮退出',
);
assert(
  jobPageWxss.includes('var(--yt-primary)') &&
    jobPageWxss.includes('env(safe-area-inset-bottom)') &&
    jobPageWxss.includes('.filter-option-grid'),
  '筛选面板应使用系统主色、适配底部安全区并采用选项网格',
);

console.log('用户端兼职区域与结算方式筛选 smoke 通过');
