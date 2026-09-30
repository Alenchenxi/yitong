import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const helper = readFileSync(resolve(root, 'utils/custom-tabbar.ts'), 'utf8');
const tabPages = [
  ['pages/square/index.ts', '/pages/square/index'],
  ['pages/confession/index.ts', '/pages/confession/index'],
  ['pages/treehole/index.ts', '/pages/treehole/index'],
  ['pages/job/index.ts', '/pages/job/index'],
  ['pages/profile/index.ts', '/pages/profile/index'],
];

assert.match(helper, /getTabBar\?\.\(\)/u, '选中态同步必须获取当前页面的 custom tabBar 实例');
assert.match(
  helper,
  /setData\(\{ selectedPath \}\)/u,
  '选中态同步必须把当前页面路径写入 tabBar 实例',
);

for (const [relativePath, pagePath] of tabPages) {
  const source = readFileSync(resolve(root, relativePath), 'utf8');
  const onShow = source.match(/async onShow\(\) \{[\s\S]*?\n  \},/u)?.[0] ?? '';

  assert(
    onShow.includes(`syncCustomTabBar(this, '${pagePath}')`),
    `${relativePath} 必须在每次 onShow 时显式同步 custom tabBar 选中路径`,
  );
}

console.log('custom tabbar active state smoke: ok');
