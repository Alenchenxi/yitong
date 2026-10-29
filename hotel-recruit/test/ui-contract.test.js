const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('普通访客有推广员申请入口，推广工具默认隐藏', () => {
  assert.match(html, /id="promoApply"/);
  assert.match(html, /<button[^>]+id="promoEntry"[^>]*>申请成为推广员<\/button>/);
  assert.match(html, /id="promoTools" hidden/);
});

test('通过他人的推广链接进入不会获得推广员身份', () => {
  assert.match(html, /var promoterCode = ''/);
  assert.doesNotMatch(html, /if \(inviter\) ensurePromoFab\(\)/);
  assert.match(html, /inviter: inviter/);
});

test('注册后保存本人推广码并切换申请入口与推广工具', () => {
  assert.match(html, /localStorage\.setItem\('promoter_self'/);
  assert.match(html, /getElementById\('promoApply'\)\.hidden = true/);
  assert.match(html, /getElementById\('promoTools'\)\.hidden = false/);
});

test('推广链接和海报使用本人推广码而不是报名归因码', () => {
  assert.match(html, /promoLink = location\.origin \+ location\.pathname \+ '\?inviter=' \+ promoterCode/);
  assert.match(html, /qr\.addData\(location\.origin \+ location\.pathname \+ '\?inviter=' \+ promoterCode\)/);
});

test('生成推广海报按钮使用高对比度亮色文字', () => {
  assert.match(html, /\.promo-fab\s*\{[^}]*background:\s*#0b5c53[^}]*color:\s*#fff/);
});

test('注册成功后提示可在当前页面直接生成专属海报', () => {
  assert.doesNotMatch(html, /打开你的链接，点右下角/);
  assert.match(html, /无需重新打开专属链接/);
  assert.match(html, /当前页面右下角「生成推广海报」/);
});
