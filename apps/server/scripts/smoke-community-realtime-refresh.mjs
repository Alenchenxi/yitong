import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const userMiniProgram = new URL('../../user-miniprogram/', import.meta.url);
const [squareTs, plazaTs, mineTs, listTs] = await Promise.all([
  readFile(new URL('pages/square/index.ts', userMiniProgram), 'utf8'),
  readFile(new URL('pages/community/plaza/index.ts', userMiniProgram), 'utf8'),
  readFile(new URL('pages/community/mine/index.ts', userMiniProgram), 'utf8'),
  readFile(new URL('pages/community/list/index.ts', userMiniProgram), 'utf8'),
]);

const squareOnShow = squareTs.match(/async onShow\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const plazaOnShow = plazaTs.match(/async onShow\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const mineOnShow = mineTs.match(/onShow\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';
const listOnShow = listTs.match(/async onShow\(\)[\s\S]*?\n  \},/u)?.[0] ?? '';

assert(
  squareOnShow.includes('await this.ensureCommunity()'),
  '圈子首页每次显示都重新获取当前圈子详情',
);
assert(
  plazaOnShow.includes('await this.load()') && !plazaOnShow.includes('circles.length'),
  '圈子广场每次显示都重新获取圈子列表',
);
assert(mineOnShow.includes('this.refresh()'), '我的圈子每次显示都重新获取圈子列表');
assert(listOnShow.includes('await this.refresh()'), '圈子切换页每次显示都重新获取圈子列表');

console.log('圈子信息与实时统计页面刷新 smoke 通过');
