import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const componentTs = readFileSync(resolve(root, 'components/admin-panels/ops/index.ts'), 'utf8');
const componentWxml = readFileSync(resolve(root, 'components/admin-panels/ops/index.wxml'), 'utf8');
const registerPage = readFileSync(resolve(root, 'pages/merchant/register/index.ts'), 'utf8');

assert.match(componentTs, /merchantReviewEnabled:\s*true/);
assert.match(componentTs, /item\.key === 'merchant\.need_review'/);
assert.match(componentTs, /merchantReviewEnabled:\s*merchantReview\?\.value !== false/);
assert.match(componentTs, /updateAppSetting\('merchant\.need_review', next\)/);
assert.match(componentWxml, />商家入驻审核</);
assert.match(componentWxml, /bindchange="toggleMerchantReview"/);
assert.match(componentWxml, /首次和二次注册需审核；关闭后提交即通过/);
assert.match(registerPage, /const m = await reapplyMerchant/);
assert.match(registerPage, /m\.status === 'APPROVED'/);
assert.match(registerPage, /重新入驻成功/);

console.log('merchant review setting smoke passed');
