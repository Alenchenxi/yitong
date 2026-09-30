import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const adminShell = read('pages/admin/index.ts');
const merchantShell = read('pages/merchant/index.ts');
const profileWxml = read('components/merchant-panels/profile/index.wxml');
const profileWxss = read('components/merchant-panels/profile/index.wxss');
const navigation = read('utils/navigation.ts');
const squareTs = read('pages/square/index.ts');
const squareWxml = read('pages/square/index.wxml');

for (const key of ['dashboard', 'review', 'ops', 'users', 'profile']) {
  assert.match(adminShell, new RegExp(`${key}:\\s*\\{\\}`), `admin ${key} params must default to an object`);
}
for (const key of ['candidates', 'jobs', 'post', 'notifications', 'profile']) {
  assert.match(merchantShell, new RegExp(`${key}:\\s*\\{\\}`), `merchant ${key} params must default to an object`);
}

assert.match(profileWxml, /class="menu-item-label"/, 'profile menu labels must use an explicit class');

const componentsRoot = fileURLToPath(new URL('../components', import.meta.url));
const componentWxssFiles = [];
function collectWxss(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) collectWxss(path);
    else if (entry.name.endsWith('.wxss')) componentWxssFiles.push(path);
  }
}
collectWxss(componentsRoot);
for (const path of componentWxssFiles) {
  const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    const selectors = match[1].trim();
    if (selectors.startsWith('@') || selectors === ':host') continue;
    assert.doesNotMatch(selectors, /(^|[ >+~,])(?:view|text|image|button|input|textarea|scroll-view|swiper|swiper-item)(?=[:.#\[\s>,+~]|$)/, `${path} must not use tag selectors`);
    assert.doesNotMatch(selectors, /(^|[\s>+~,])#[\w-]+/, `${path} must not use ID selectors`);
    assert.doesNotMatch(selectors, /\[[^\]]+\]/, `${path} must not use attribute selectors`);
  }
}

assert.doesNotMatch(navigation, /getSystemInfoSync/, 'deprecated wx.getSystemInfoSync must not be used');
assert.match(navigation, /wx\.getWindowInfo\(\)/, 'navigation layout must use wx.getWindowInfo');

assert.doesNotMatch(squareWxml, /wx:key="[^"\s]*\.[^"\s]*"/, 'wx:key must be a top-level property name');
assert.match(squareWxml, /wx:key="feedKey"/, 'feed loops must use the stable top-level feedKey');
assert.match(squareTs, /feedKey:/, 'feed data must expose the top-level feedKey');

console.log('runtime warning contracts: all passed');
