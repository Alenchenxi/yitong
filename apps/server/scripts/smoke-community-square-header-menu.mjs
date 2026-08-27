import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const base = new URL('../../user-miniprogram/pages/square/', import.meta.url);
const [wxml, wxss, ts, appConfigText] = await Promise.all([
  readFile(new URL('index.wxml', base), 'utf8'),
  readFile(new URL('index.wxss', base), 'utf8'),
  readFile(new URL('index.ts', base), 'utf8'),
  readFile(new URL('../../user-miniprogram/app.json', import.meta.url), 'utf8'),
]);
const appConfig = JSON.parse(appConfigText);

const titleIndex = wxml.indexOf('class="topbar-title">广场</view>');
const actionsIndex = wxml.indexOf('class="header-actions"');
assert(titleIndex >= 0, '顶部保留“广场”标题');
assert(actionsIndex > titleIndex, '圈子切换与搜索位于“广场”标题下方');
const topbarStyle = wxss.match(/\.topbar\s*\{[\s\S]*?\}/u)?.[0] ?? '';
const titleStyle = wxss.match(/\.topbar-title\s*\{[\s\S]*?\}/u)?.[0] ?? '';
assert(
  topbarStyle.includes('justify-content: center') &&
    !wxml.includes('padding-right: {{navRight}}px') &&
    !topbarStyle.includes('padding-left'),
  '“广场”标题按页面可用宽度水平居中',
);
assert(titleStyle.includes('font-weight: 400'), '“广场”标题使用正常字重');
assert(titleStyle.includes('font-size: 17px'), '“广场”标题字号与原生导航栏标题一致');

const tabBarItems = appConfig.tabBar?.list ?? [];
assert.equal(tabBarItems.length, 5, '用户端保留 5 个底部菜单');
assert(
  tabBarItems.every((item) => item.iconPath && item.selectedIconPath),
  '每个底部菜单均配置默认与选中图标',
);
const tabBarIconUrls = tabBarItems.flatMap((item) => [
  new URL(`../../user-miniprogram/${item.iconPath}`, import.meta.url),
  new URL(`../../user-miniprogram/${item.selectedIconPath}`, import.meta.url),
]);
const tabBarIconStats = await Promise.all(tabBarIconUrls.map((url) => stat(url)));
assert(
  tabBarIconStats.every((iconStat) => iconStat.size > 0),
  '底部菜单的 10 个图标资源均存在且非空',
);

const switchIndex = wxml.indexOf('查看与切换圈子');
const inviteIndex = wxml.indexOf('邀请好友');
const leaveIndex = wxml.indexOf('退出圈子');
assert(switchIndex >= 0, '菜单包含查看与切换圈子');
assert(inviteIndex > switchIndex, '邀请好友位于查看与切换圈子之后');
assert(leaveIndex > inviteIndex, '退出圈子位于邀请好友之后');

const menuFn = ts.match(/async showCommunityMenu\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const onHideFn = ts.match(/onHide\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const onShowFn = ts.match(/async onShow\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const ensureCommunityFn = ts.match(/async ensureCommunity\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
assert(menuFn.includes('await getCommunity(current.id)'), '菜单展开前调用圈子详情接口');
assert(menuFn.indexOf('await getCommunity(current.id)') < menuFn.indexOf('menuVisible: true'), '详情刷新完成后再展开菜单');
assert(
  menuFn.includes('const requestSeq = ++this._communityMenuRequestSeq') &&
    (menuFn.match(/requestSeq !== this\._communityMenuRequestSeq/gu)?.length ?? 0) === 2 &&
    (menuFn.match(/this\.data\.community\?\.id !== current\.id/gu)?.length ?? 0) === 2,
  '详情写入和菜单展开前均校验请求代次与当前圈子',
);
assert(
  onHideFn.includes('this._communityMenuRequestSeq += 1') &&
    onHideFn.includes('menuVisible: false'),
  '页面隐藏时废弃菜单请求并关闭菜单',
);
assert(
  onShowFn.includes('await this.ensureCommunity()') &&
    ensureCommunityFn.includes('await getActiveCommunity()'),
  '每次页面展示都通过当前圈子接口刷新圈子信息与动态数',
);
assert(ts.includes('leaveCommunity(community.id)'), '退出圈子按钮调用退出接口');
assert(ts.includes("community.myRole === 'OWNER'"), '圈主退出前端给出明确提示');

console.log('圈子广场标题、底栏图标、菜单与动态刷新静态验收通过（18/18）');
