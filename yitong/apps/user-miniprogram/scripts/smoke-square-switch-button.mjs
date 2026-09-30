import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'pages/square/index.wxml'), 'utf8');
const styles = readFileSync(resolve(root, 'pages/square/index.wxss'), 'utf8');

assert.match(
  template,
  /class="circle-switch"[\s\S]*bindtap="goSwitch"[\s\S]*class="cs-switch-icon"[\s\S]*<text class="cs-switch-label">切换<\/text>/u,
  '广场左上角必须提供带图标和“切换”文字的圈子切换按钮，并保留原跳转行为',
);
assert.doesNotMatch(template, /class="cs-logo|class="cs-name|class="cs-arrow/u, '切换按钮不应展示当前圈头像、名称或下拉箭头');
assert.match(styles, /\.circle-switch\s*\{[\s\S]*?width\s*:\s*136rpx/u, '切换按钮宽度必须固定，避免压缩搜索栏');
assert.match(styles, /\.cs-switch-icon\s*\{/u, '切换按钮必须定义图标容器样式');
assert.match(styles, /\.cs-switch-label\s*\{/u, '切换按钮必须定义文字样式');

const circleRadius = styles.match(/\.circle-switch\s*\{[\s\S]*?border-radius\s*:\s*([^;]+)/u)?.[1].trim();
const searchRadius = styles.match(/\.search-box\s*\{[\s\S]*?border-radius\s*:\s*([^;]+)/u)?.[1].trim();
assert.ok(circleRadius, '切换按钮必须定义圆角');
assert.ok(searchRadius, '搜索栏必须定义圆角');
assert.equal(circleRadius, searchRadius, '切换按钮圆角必须与搜索栏一致');
assert.match(styles, /\.cs-switch-icon\s*\{[^}]*width\s*:\s*24rpx[^}]*height\s*:\s*24rpx/u, '切换图标尺寸必须与文字 24rpx 视觉基准一致');
assert.match(styles, /\.cs-switch-label\s*\{[^}]*font-size\s*:\s*24rpx/u, '切换文字字号必须为 24rpx');
console.log('square switch button smoke: ok');
