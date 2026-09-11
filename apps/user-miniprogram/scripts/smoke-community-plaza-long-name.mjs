import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'pages/community/plaza/index.wxml'), 'utf8');
const styles = readFileSync(resolve(root, 'pages/community/plaza/index.wxss'), 'utf8');

assert.match(template, /class="name-row"[\s\S]*class="name"[\s\S]*joined-tag/u, '圈子名称必须与已加入标签处在同一行');
assert.match(styles, /\.name-row\s*\{[\s\S]*min-width\s*:\s*0/u, '标题行必须允许在卡片内收缩');
assert.match(styles, /\.name\s*\{[\s\S]*flex\s*:\s*1/u, '圈子名称必须只占用操作按钮之外的剩余空间');
assert.match(styles, /\.name\s*\{[\s\S]*min-width\s*:\s*0/u, '圈子名称必须允许超长文本收缩并触发省略');
assert.match(styles, /\.join-btn\s*\{[\s\S]*flex-shrink\s*:\s*0/u, '加入按钮不能被超长圈名挤压');

console.log('community plaza long-name smoke: ok');
