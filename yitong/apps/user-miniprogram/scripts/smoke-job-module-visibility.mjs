import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 用户端兼职板块平台开关 smoke：静态校验开关链路各环节均在位（默认关闭 / fail closed / 入口隐藏 / 页面守卫）。
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const appConfig = JSON.parse(read('app.json'));
assert.equal(appConfig.tabBar.custom, true, '底部导航必须启用 custom tabBar');
assert.ok(
  appConfig.tabBar.list.some((item) => item.pagePath === 'pages/job/index'),
  '兼职必须保留为可切换 tab 页面（显隐交给 custom tabBar 过滤）',
);

const appSource = read('app.ts');
assert.match(
  appSource,
  /onShow\(options\)\s*\{\s*void this\.refreshAnonymousContentVisibility\(\);\s*void this\.refreshJobModuleVisibility\(\)/,
  '小程序首次启动和重新进入前台时必须刷新兼职板块配置',
);
assert.equal(
  (appSource.match(/fetchJobModuleVisibility\(\)/g) ?? []).length,
  1,
  '兼职板块接口只能由统一重试方法调用',
);
assert.match(appSource, /fetchJobModuleVisibilityWithRetry\(\)/);
assert.match(appSource, /jobModuleEnabled:/);
assert.match(appSource, /persistJobModuleVisibility\(enabled\)/);
assert.match(
  appSource,
  /\.catch\(\(\) => this\.applyJobModuleRefresh\(refreshVersion, false\)\)/,
  '兼职板块配置请求失败时必须 fail closed（默认隐藏）',
);
assert.match(
  appSource,
  /\.finally\(\(\) => \{[\s\S]*this\._jobModuleRefreshPromise = null;/,
  '兼职板块请求完成后必须释放 Promise，允许下次进入重试',
);

const appConfigService = read('services/app-config.ts');
assert.match(appConfigService, /JOB_MODULE_CACHE_KEY/);
assert.match(appConfigService, /url: '\/app-config\/job'/);
assert.match(appConfigService, /response\.jobEnabled === true/);

const customTabBar = read('custom-tab-bar/index.ts');
assert.match(customTabBar, /jobOnly:\s*true/);
assert.match(customTabBar, /subscribeJobModuleVisibility/);
assert.match(customTabBar, /jobModuleEnabled \|\| !item\.jobOnly/);

// 兼职入口消费方：必须订阅开关显隐
const jobVisibilityConsumers = [
  'pages/square/index.ts',
  'pages/profile/index.ts',
  'pages/favorites/index.ts',
  'pages/content-search/index.ts',
  'pages/role-select/index.ts',
];
for (const relativePath of jobVisibilityConsumers) {
  const source = read(relativePath);
  assert.match(source, /bindJobModuleVisibility\(this,/, `${relativePath} must subscribe job module visibility`);
  assert.match(source, /unbindJobModuleVisibility\(this\)/, `${relativePath} must unsubscribe job module visibility`);
}

// 页面级守卫：板块关闭时 user 角色退出（商家/管理放行）
const guardedJobPages = [
  'pages/job/index.ts',
  'pages/job/detail/index.ts',
  'pages/job/search/index.ts',
  'pages/job/apply/index.ts',
  'pages/job/my-applications/index.ts',
  'pages/job/chat/index.ts',
  'pages/resume/index.ts',
];
for (const relativePath of guardedJobPages) {
  const source = read(relativePath);
  assert.match(source, /bindJobModulePageGuard\(this\)/, `${relativePath} must guard page`);
  assert.match(source, /requireJobModuleVisibility\(\)/, `${relativePath} must re-check visibility before loading`);
}

// 商家发岗流程不受开关影响：publish / post-create 不得接入退出式守卫
for (const relativePath of ['pages/job/publish/index.ts', 'pages/job/post-create/index.ts']) {
  const source = read(relativePath);
  assert.doesNotMatch(
    source,
    /bindJobModulePageGuard|requireJobModuleVisibility/,
    `${relativePath} 是商家发岗流程，禁止接入兼职板块退出守卫`,
  );
}

assert.match(read('pages/square/index.wxml'), /wx:if="{{jobModuleEnabled}}"[^>]*data-tab="job"/, '广场兼职 tab 必须由开关控制');
assert.match(read('pages/profile/index.wxml'), /wx:if="{{jobModuleEnabled}}"[^>]*bindtap="goMyJobs"/, '我的兼职入口必须由开关控制');
assert.match(read('pages/profile/index.wxml'), /wx:if="{{jobModuleEnabled}}"[^>]*bindtap="goResume"/, '我的简历入口必须由开关控制');
assert.match(read('pages/favorites/index.wxml'), /wx:if="{{jobModuleEnabled}}"[^>]*data-tab="job_post"/, '收藏兼职 tab 必须由开关控制');
assert.match(read('pages/favorites/index.ts'), /item\.targetType !== 'job_post'/, '收藏列表必须过滤兼职收藏');
assert.match(read('pages/content-search/index.ts'), /jobOnly:\s*true/, '内容搜索兼职 tab 必须受开关过滤');
assert.match(read('components/admin-panels/ops/index.ts'), /updateAppSetting\('job\.enabled', next\)/, '管理端系统设置必须能写兼职板块开关');
assert.match(read('components/admin-panels/ops/index.wxml'), /bindchange="toggleJobModule"/, '管理端系统设置必须有兼职板块开关 UI');

console.log('job module visibility smoke: ok');
