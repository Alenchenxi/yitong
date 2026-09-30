import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appStyles = readFileSync(resolve(root, 'app.wxss'), 'utf8');
const tabbarStyles = readFileSync(resolve(root, 'custom-tab-bar/index.wxss'), 'utf8');
const pageStyles = [
  'pages/square/index.wxss',
  'pages/confession/index.wxss',
  'pages/treehole/index.wxss',
];

assert.match(
  appStyles,
  /--yt-tabbar-height:\s*104rpx;/u,
  '全局样式必须声明与 custom tabBar 一致的内容高度',
);
assert.match(
  appStyles,
  /--yt-fab-tabbar-gap:\s*24rpx;/u,
  '全局样式必须声明悬浮创建按钮与 custom tabBar 的间距',
);
assert.match(
  appStyles,
  /--yt-fab-bottom:\s*calc\(var\(--yt-tabbar-height\)\s*\+\s*env\(safe-area-inset-bottom\)\s*\+\s*var\(--yt-fab-tabbar-gap\)\);/u,
  '全局样式必须统一计算悬浮创建按钮的最终安全偏移',
);
assert.match(
  tabbarStyles,
  /height:\s*var\(--yt-tabbar-height,\s*104rpx\);/u,
  'custom tabBar 必须复用全局底栏高度，并保留兼容回退值',
);

for (const relativePath of pageStyles) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  const fabRule = source.match(/\.fab\s*\{[\s\S]*?\}/u)?.[0] ?? '';

  assert.match(
    fabRule,
    /bottom:\s*var\(--yt-fab-bottom\);/u,
    `${relativePath} 的创建按钮必须完整避让 custom tabBar、安全区和视觉间距`,
  );
}

console.log('tabbar create button safe area smoke: ok');
