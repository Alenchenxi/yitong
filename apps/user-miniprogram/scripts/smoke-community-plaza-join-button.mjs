import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'pages/community/plaza/index.wxml'), 'utf8');
const styles = readFileSync(resolve(root, 'pages/community/plaza/index.wxss'), 'utf8');

assert.match(template, /class="join-btn"[\s\S]*>加入<\/view>/u, '非成员圈子必须保留加入按钮');
assert.match(styles, /\.right\s*\{[\s\S]*min-width\s*:\s*0[\s\S]*width\s*:\s*0/u, '右侧滚动区必须允许在布局中收缩');
assert.match(styles, /\.card\s*\{[\s\S]*width\s*:\s*100%[\s\S]*min-width\s*:\s*0[\s\S]*box-sizing\s*:\s*border-box/u, '圈子卡片必须锁定在右侧可视宽度内');
assert.match(styles, /\.info\s*\{[\s\S]*flex\s*:\s*1[\s\S]*min-width\s*:\s*0[\s\S]*width\s*:\s*0/u, '圈子信息区必须让位给加入按钮');
assert.match(styles, /\.join-btn\s*\{[\s\S]*flex-shrink\s*:\s*0/u, '加入按钮不能被圈子名称挤压');

console.log('community plaza join-button smoke: ok');