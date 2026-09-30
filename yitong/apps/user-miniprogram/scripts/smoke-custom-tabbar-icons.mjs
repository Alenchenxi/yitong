import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'custom-tab-bar/index.wxml'), 'utf8');

assert.doesNotMatch(
  template,
  /<cover-(?:view|image)\b/,
  'custom tabBar 不得使用动态切换时易出现异常图像节点的 cover-view/cover-image',
);
assert.match(template, /<view class="tabbar">/);
assert.match(template, /wx:for="{{items}}"/);
assert.match(template, /wx:key="pagePath"/);
assert.match(template, /<image\s+[\s\S]*class="tabbar-icon"[\s\S]*mode="aspectFit"/);
assert.match(template, /item\.selectedIconPath\s*:\s*item\.iconPath/);

console.log('custom tabbar icon rendering smoke: ok');
