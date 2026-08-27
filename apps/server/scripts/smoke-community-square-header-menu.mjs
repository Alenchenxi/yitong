import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const base = new URL('../../user-miniprogram/pages/square/', import.meta.url);
const [wxml, wxss, ts, pageConfigText, appConfigText] = await Promise.all([
  readFile(new URL('index.wxml', base), 'utf8'),
  readFile(new URL('index.wxss', base), 'utf8'),
  readFile(new URL('index.ts', base), 'utf8'),
  readFile(new URL('index.json', base), 'utf8'),
  readFile(new URL('../../user-miniprogram/app.json', import.meta.url), 'utf8'),
]);
const pageConfig = JSON.parse(pageConfigText);
const appConfig = JSON.parse(appConfigText);

const communityMenuIcon = new URL('../../user-miniprogram/assets/icons/community-menu.svg', import.meta.url);
const topbarIndex = wxml.indexOf('class="topbar"');
const actionsIndex = wxml.indexOf('class="header-actions"');
const contentIndex = wxml.indexOf('class="community-header-content"');
assert.equal(pageConfig.navigationStyle, 'custom', '广场恢复使用自定义导航');
assert(!('navigationBarTitleText' in pageConfig), '页面配置不再声明可见“广场”标题');
assert(!wxml.includes('class="topbar-title"'), '自定义导航不渲染“广场”标题节点');
assert(topbarIndex >= 0 && actionsIndex > topbarIndex && actionsIndex < contentIndex, '圈子切换与搜索直接占用原标题导航区域');
assert(
  wxml.includes('style="padding-top: {{navTop}}px;"') &&
    wxml.includes('height: {{navHeight}}px; padding-right: {{navRight}}px;'),
  '导航结构使用状态栏高度、导航高度与胶囊右侧避让值',
);
const topbarStyle = wxss.match(/\.topbar\s*\{[\s\S]*?\}/u)?.[0] ?? '';
const topbarActionsStyle = wxss.match(/\.topbar-actions\s*\{[\s\S]*?\}/u)?.[0] ?? '';
assert(
  topbarStyle.includes('position: relative') &&
    topbarActionsStyle.includes('display: flex') &&
    topbarActionsStyle.includes('box-sizing: border-box'),
  '自定义导航操作行按安全区尺寸布局',
);
assert(
  ts.includes('navTop: number') &&
    ts.includes('navHeight: number') &&
    ts.includes('navRight: number') &&
    ts.includes('wx.getSystemInfoSync()') &&
    ts.includes('wx.getMenuButtonBoundingClientRect()'),
  '页面维护状态栏、导航栏和胶囊避让数据',
);
assert(
  ts.includes('const navTop = system.statusBarHeight ?? 0') &&
    ts.includes('(menu.top - navTop) * 2 + menu.height') &&
    ts.includes('system.screenWidth - menu.left') &&
    ts.includes('this.setData({ navTop, navHeight, navRight })'),
  '导航尺寸按状态栏与微信胶囊位置计算',
);

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

const inviteIndex = wxml.indexOf('邀请好友');
const leaveIndex = wxml.indexOf('退出圈子');
assert(inviteIndex >= 0, '菜单包含邀请好友');
assert(leaveIndex > inviteIndex, '退出圈子位于邀请好友之后');
assert(!wxml.includes('查看与切换圈子'), '下拉菜单不展示查看与切换圈子');

const menuFn = ts.match(/async showCommunityMenu\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const onHideFn = ts.match(/onHide\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const onShowFn = ts.match(/async onShow\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
assert(
  wxml.includes('class="c-menu-icon" src="/assets/icons/community-menu.svg"') &&
    !wxml.includes('>•••</view>'),
  '圈子头卡使用本地标准菜单图标，不再显示文字省略号',
);
assert((await stat(communityMenuIcon)).size > 0, '圈子菜单 SVG 图标资源存在且非空');
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

console.log('圈子广场自定义导航、底栏图标、菜单与动态刷新静态验收通过');
