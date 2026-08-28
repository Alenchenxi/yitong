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
  placeClientTs,
] = await Promise.all([
  readFile(new URL('../src/modules/job/job.controller.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/job/location.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/job/job.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/modules/job/dto/job.dto.ts', import.meta.url), 'utf8'),
  readFile(new URL('pages/job/index.ts', miniprogram), 'utf8'),
  readFile(new URL('pages/job/index.wxml', miniprogram), 'utf8'),
  readFile(new URL('pages/job/index.wxss', miniprogram), 'utf8'),
  readFile(new URL('services/job.ts', miniprogram), 'utf8'),
  readFile(new URL('services/place-suggest.ts', miniprogram), 'utf8'),
]);

assert(
  controllerTs.includes("@Get('job-posts/location-context')") &&
    controllerTs.includes('this.location.getLocationContext'),
  '服务端应提供坐标对应城市与全部区县的 location-context 接口',
);
assert(
  locationServiceTs.includes('@province-city-china/area') &&
    locationServiceTs.includes('districts') &&
    locationServiceTs.includes('addressComponent'),
  '定位服务应从行政区划数据生成当前城市的全部区县，并读取反向定位区县',
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
  placeClientTs.includes('getLocationContext') &&
    placeClientTs.includes('/job-posts/location-context?'),
  '小程序应封装城市区县上下文请求',
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
    jobPageTs.includes('city: this.data.appliedDistrict ? this.data.currentCity') &&
    jobPageTs.includes('settlement: this.data.appliedSettlement || undefined'),
  '普通列表和推荐列表应使用已应用的区域与结算方式筛选',
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
