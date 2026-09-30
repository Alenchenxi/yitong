import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'custom-tab-bar/index.ts'), 'utf8');
const switchTab = source.match(/switchTab\(e:[\s\S]*?\n    \},/u)?.[0] ?? '';

assert.match(switchTab, /wx\.switchTab\(\{ url: path \}\);/u, '底栏点击必须通过 wx.switchTab 切换页面');
assert.doesNotMatch(
  switchTab,
  /setData\(\{ selectedPath: path \}\)/u,
  '导航完成前不得提前重绘旧页面的底栏选中态',
);

console.log('custom tabbar transition smoke: ok');
