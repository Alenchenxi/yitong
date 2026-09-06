import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const appJson = read('app.json');
const confessionWxml = read('pages/confession/index.wxml');
const confessionTs = read('pages/confession/index.ts');
const treeholeWxml = read('pages/treehole/index.wxml');
const treeholeTs = read('pages/treehole/index.ts');
const nearbyTs = read('components/nearby-people/index.ts');
const nearbyWxml = read('components/nearby-people/index.wxml');
const confessionWxss = read('pages/confession/index.wxss');
const treeholeWxss = read('pages/treehole/index.wxss');
const squareWxss = read('pages/square/index.wxss');
const nearbyService = read('services/nearby.ts');

const mainTabsBlock = (styles) => styles.match(/\.main-tabs\s*\{([^}]*)\}/)?.[1] ?? '';

assert.match(appJson, /附近的人/, '定位用途必须包含附近的人');
assert.match(confessionWxml, /data-tab="nearby"[^>]*>附近的人</, '表白墙必须有附近的人分类');
assert.match(
  confessionWxml,
  /nearby-people[^>]*channel="confession"/,
  '表白墙必须使用实名附近列表',
);
assert.match(treeholeWxml, /data-tab="nearby"[^>]*>附近的人</, '树洞必须有附近的人分类');
assert.match(treeholeWxml, /nearby-people[^>]*channel="treehole"/, '树洞必须使用匿名附近列表');
assert.match(
  confessionWxml,
  /wx:if="\{\{activeMainTab !== 'nearby'\}\}"[^>]*class="fab"/,
  '附近的人分类必须隐藏表白墙发布按钮',
);
assert.match(
  treeholeWxml,
  /wx:if="\{\{activeTab !== 'nearby'\}\}"[^>]*class="fab"/,
  '附近的人分类必须隐藏树洞发布按钮',
);

assert.match(nearbyTs, /wx\.getFuzzyLocation/, '附近的人必须使用微信模糊定位');
assert.match(nearbyTs, /wx\.showModal/, '首次开启附近可见必须显式确认');
assert.match(nearbyTs, /openAppAuthorizeSetting|openSetting/, '定位拒绝后必须提供设置恢复路径');
assert.match(nearbyTs, /toggleFollow/, '附近列表必须支持关注');
assert.match(nearbyTs, /pages\/user-profile\/index/, '实名查看必须进入真实用户主页');
assert.match(nearbyTs, /pages\/treehole\/author\/index/, '树洞查看必须进入匿名主页');
assert.match(nearbyWxml, /distanceLabel/, '列表必须展示模糊距离');
assert.match(nearbyWxml, /查看/, '列表必须提供查看按钮');
assert.match(nearbyWxml, /附近可见/, '列表必须提供附近可见控制');

for (const [name, styles] of [
  ['圈子动态', squareWxss],
  ['表白墙', confessionWxss],
  ['树洞', treeholeWxss],
]) {
  const tabs = mainTabsBlock(styles);
  assert.match(tabs, /gap:\s*32rpx/, `${name}分类栏必须使用统一紧凑间距`);
  assert.doesNotMatch(tabs, /justify-content:\s*space-between/, `${name}分类栏不得分散对齐`);
}

assert.match(nearbyService, /users\/me\/nearby-presence/, '实名可见性接口缺失');
assert.match(nearbyService, /users\/nearby/, '实名附近列表接口缺失');
assert.match(nearbyService, /treehole\/nearby-presence/, '匿名可见性接口缺失');
assert.match(nearbyService, /treehole\/nearby/, '匿名附近列表接口缺失');
assert.doesNotMatch(nearbyService, /'lng='|'lat='/, '附近列表请求不得携带客户端坐标');
assert.doesNotMatch(nearbyTs, /this\.data\.(longitude|latitude)/, '分页不得复用客户端坐标');

assert.match(
  confessionTs,
  /activeMainTab === 'nearby'/,
  '表白墙页面必须将分页和刷新委托给附近列表',
);
assert.match(treeholeTs, /activeTab === 'nearby'/, '树洞页面必须将分页和刷新委托给附近列表');
assert.match(
  confessionTs,
  /onShow[^]*activeMainTab === 'nearby'[^]*getNearbyComponent\(\)\?\.refresh\(\)/,
  '表白墙从后台返回且停留在附近的人时必须刷新位置和列表',
);
assert.match(
  treeholeTs,
  /onShow[^]*activeTab === 'nearby'[^]*getNearbyComponent\(\)\?\.refresh\(\)/,
  '树洞从后台返回且停留在附近的人时必须刷新位置和列表',
);

console.log('nearby people smoke: ok');
