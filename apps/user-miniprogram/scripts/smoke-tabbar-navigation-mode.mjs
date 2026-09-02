import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const headerStyles = readFileSync(resolve(root, 'components/tab-page-header/index.wxss'), 'utf8');
const titleRule = headerStyles.match(/\.tab-page-header__title\s*\{[\s\S]*?\}/u)?.[0] ?? '';
const tabPages = [
  ['pages/square/index', null],
  ['pages/confession/index', '表白墙'],
  ['pages/treehole/index', '树洞'],
  ['pages/job/index', '兼职'],
  ['pages/profile/index', '我的'],
];

assert.match(titleRule, /font-size:\s*34rpx;/u, '共享页头标题必须使用 34rpx 标题字号');
assert.match(titleRule, /font-weight:\s*400;/u, '共享页头标题必须使用 400 常规字重');

for (const [pagePath, title] of tabPages) {
  const config = JSON.parse(readFileSync(resolve(root, `${pagePath}.json`), 'utf8'));
  assert.equal(config.navigationStyle, 'custom', `${pagePath} 必须与其他 tab 页统一使用 custom 导航`);

  if (!title) continue;
  assert.equal(
    config.usingComponents?.['tab-page-header'],
    '/components/tab-page-header/index',
    `${pagePath} 必须复用统一 tab 页头组件`,
  );
  const template = readFileSync(resolve(root, `${pagePath}.wxml`), 'utf8');
  assert.match(
    template,
    new RegExp(`<tab-page-header\\s+title="${title}"(?:\\s*/>|>[\\s\\S]*?</tab-page-header>)`),
    `${pagePath} 必须展示对应底栏标题`,
  );
}

console.log('tabbar navigation mode smoke: ok');
