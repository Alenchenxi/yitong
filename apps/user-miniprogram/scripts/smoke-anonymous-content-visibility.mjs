import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const appConfig = JSON.parse(read('app.json'));
assert.equal(appConfig.tabBar.custom, true, '底部导航必须启用 custom tabBar');
assert.ok(appConfig.pages.includes('pages/treehole/index'), '树洞首页必须重新注册');
assert.ok(appConfig.pages.includes('pages/my-anon-posts/index'), '我的树洞必须重新注册');
assert.ok(
  appConfig.tabBar.list.some((item) => item.pagePath === 'pages/treehole/index'),
  '树洞必须保留为可切换 tab 页面',
);

const appSource = read('app.ts');
assert.match(
  appSource,
  /onShow\(options\)\s*\{\s*void this\.refreshAnonymousContentVisibility\(\)/,
  '小程序首次启动和重新进入前台时必须刷新匿名内容配置',
);
assert.equal(
  (appSource.match(/fetchAnonymousContentVisibility\(\)/g) ?? []).length,
  1,
  '匿名内容接口只能由统一重试方法调用',
);
assert.match(appSource, /ANONYMOUS_CONTENT_RETRY_DELAYS_MS = \[250, 750\]/);
assert.match(appSource, /fetchAnonymousContentVisibilityWithRetry\(\)/);
assert.match(appSource, /anonymousContentEnabled:/);
assert.match(appSource, /persistAnonymousContentVisibility\(enabled\)/);
assert.match(
  appSource,
  /\.catch\(\(\) => this\.applyAnonymousContentRefresh\(refreshVersion, false\)\)/,
  '匿名内容配置请求失败时必须 fail closed',
);
assert.match(
  appSource,
  /\.finally\(\(\) => \{[\s\S]*this\._anonymousContentRefreshPromise = null;/,
  '匿名内容请求完成后必须释放 Promise，允许下次进入重试',
);

const appConfigSource = read('services/app-config.ts');
assert.match(appConfigSource, /data:\s*\{ cacheBust:\s*Date\.now\(\) \}/);
assert.match(appConfigSource, /'Cache-Control':\s*'no-cache'/);

const customTabBar = read('custom-tab-bar/index.ts');
assert.match(customTabBar, /anonymousOnly:\s*true/);
assert.match(customTabBar, /subscribeAnonymousContentVisibility/);

const postCreate = read('pages/post-create/index.ts');
assert.match(postCreate, /showAnonymousPublish = await app\.getAnonymousContentVisibility\(\)/);
assert.match(postCreate, /bindAnonymousContentVisibility\(this,/);
assert.match(postCreate, /unbindAnonymousContentVisibility\(this\)/);
assert.match(postCreate, /isAnonymous: this\.data\.showAnonymousPublish && this\.data\.isAnonymous/);
assert.match(read('pages/post-create/index.wxml'), /wx:if="{{showAnonymousPublish}}"/);

const retainedVisibilityConsumers = [
  'pages/content-search/index.ts',
  'pages/favorites/index.ts',
  'pages/role-select/index.ts',
  'pages/profile/index.ts',
  'pages/square/index.ts',
  'pages/confession/index.ts',
  'pages/confession-search/index.ts',
  'pages/confession/topic-detail/index.ts',
  'pages/confession/today-hit/index.ts',
  'pages/confession/activity-detail/index.ts',
  'pages/my-posts/index.ts',
  'pages/help/faq/index.ts',
  'components/notifications-view/index.ts',
];
for (const relativePath of retainedVisibilityConsumers) {
  const source = read(relativePath);
  assert.match(source, /bindAnonymousContentVisibility\(this,/, `${relativePath} must subscribe`);
  assert.match(source, /unbindAnonymousContentVisibility\(this\)/, `${relativePath} must unsubscribe`);
}

const anonymousOnlyRetainedPages = [
  'pages/treehole/detail/index.ts',
  'pages/treehole/chat/index.ts',
  'pages/treehole/author/index.ts',
  'pages/treehole/matches/index.ts',
  'pages/treehole/party/index.ts',
  'pages/treehole/quiz/index.ts',
  'pages/treehole/post/index.ts',
  'pages/treehole/group-create/index.ts',
  'pages/treehole/profile/index.ts',
  'pages/treehole/groups/index.ts',
  'pages/treehole/group-detail/index.ts',
  'pages/treehole/my-groups/index.ts',
  'pages/my-anon-posts/index.ts',
];
for (const relativePath of anonymousOnlyRetainedPages) {
  const source = read(relativePath);
  assert.match(source, /bindAnonymousContentPageGuard\(this\)/, `${relativePath} must guard retained pages`);
  assert.match(source, /unbindAnonymousContentVisibility\(this\)/, `${relativePath} must unsubscribe`);
}

assert.match(
  read('pages/confession/today-hit/index.ts'),
  /if \(changed && this\._anonymousContentVisibilityReady\) void this\.reload\(\)/,
  'today-hit must reload when anonymous content is re-enabled from an empty filtered list',
);
assert.match(
  read('pages/boost/index.ts'),
  /options\.type === 'anon_post' && !await app\.getAnonymousContentVisibility\(\)/,
);

const favorites = read('pages/favorites/index.ts');
assert.match(favorites, /favorites\.filter\(\(item\) => !item\.targetAnonymous\)/);
const notifications = read('components/notifications-view/index.ts');
assert.match(notifications, /return !notification\.targetAnonymous/);
const myPosts = read('pages/my-posts/index.ts');
assert.match(myPosts, /favorites\.filter\(\(favorite\) => !favorite\.targetAnonymous\)/);
const profile = read('pages/profile/index.ts');
assert.match(profile, /filter\(\(notification\) => !notification\.targetAnonymous\)/);
assert.doesNotMatch(read('pages/treehole/detail/index.wxss'), /#ff4d6d|#6b7fd7/i);
assert.doesNotMatch(read('pages/favorites/index.wxss'), /#ff4d6d|#6b7fd7/i);
assert.doesNotMatch(read('pages/my-anon-posts/index.wxss'), /#ff4d6d|#6b7fd7/i);

const square = read('pages/square/index.ts');
assert.match(square, /anonymousContentEnabled = await app\.getAnonymousContentVisibility\(\)/);
assert.match(square, /item\.kind !== 'anon_post'/);
assert.match(square, /!\(item\.kind === 'post' && item\.data\.isAnonymous\)/);
assert.match(read('pages/square/index.wxml'), /wx:if="{{anonymousContentEnabled}}"/);

const guardedRoutes = [
  'pages/treehole/post/index.ts',
  'pages/treehole/detail/index.ts',
  'pages/treehole/chat/index.ts',
  'pages/treehole/party/index.ts',
  'pages/treehole/groups/index.ts',
  'pages/treehole/group-create/index.ts',
  'pages/treehole/group-detail/index.ts',
  'pages/treehole/my-groups/index.ts',
  'pages/treehole/profile/index.ts',
  'pages/treehole/author/index.ts',
  'pages/treehole/quiz/index.ts',
  'pages/treehole/matches/index.ts',
  'pages/my-anon-posts/index.ts',
];
for (const route of guardedRoutes) {
  assert.match(
    read(route),
    /requireAnonymousContentVisibility/,
    `${route} 必须接入匿名内容路由守卫`,
  );
}

console.log('anonymous content visibility smoke: ok');
