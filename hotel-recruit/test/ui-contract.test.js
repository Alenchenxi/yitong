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

test('海报邀请码下方展示客服联系方式，号码来自 env 配置', () => {
  assert.match(html, /var servicePhone = String\(PAGE_CONFIG\.posterContactPhone \|\| ''\)\.trim\(\)/);
  assert.match(html, /if \(servicePhone\) \{/);
  assert.match(html, /'客服联系方式：' \+ servicePhone \+ '（微信同号）'/);
});

test('生成推广海报按钮使用高对比度亮色文字', () => {
  assert.match(html, /\.promo-fab\s*\{[^}]*background:\s*#0b5c53[^}]*color:\s*#fff/);
});

test('注册成功后提示可在当前页面直接生成专属海报', () => {
  assert.doesNotMatch(html, /打开你的链接，点右下角/);
  assert.match(html, /无需重新打开专属链接/);
  assert.match(html, /当前页面右下角「生成推广海报」/);
});

test('报名成功弹窗包含酒店群码区块且默认隐藏', () => {
  assert.match(html, /id="okQrWrap" hidden/);
  assert.match(html, /id="okQr"/);
  assert.match(html, /长按识别二维码/);
});

test('报名成功后按酒店名加载群码，jpg 缺图回退 png 再隐藏', () => {
  assert.match(html, /qrWrap\.hidden = true/);
  assert.match(html, /qrImg\.onload = function \(\) \{ qrWrap\.hidden = false; \}/);
  assert.match(html, /qrImg\.src = 'qr\/' \+ encodeURIComponent\(currentHotel\) \+ '\.jpg'/);
  assert.match(html, /qrImg\.onerror = function \(\) \{/);
  assert.match(html, /\.jpg\$\/\.test\(qrImg\.src\)/);
  assert.match(html, /qrImg\.src\.replace\(\/\\\.jpg\$\/, '\.png'\)/);
  assert.match(html, /qrWrap\.hidden = true;\s*\n\s*\};/);
});

test('报名成功弹窗并排展示酒店群码与校园云小程序码，文案在前、长按提示在后', () => {
  assert.match(html, /<div class="ok-qr-row">\s*<div class="ok-qr" id="okQrWrap" hidden>/); // 群码在左，缺失时不占位
  const campus = html.match(/<div class="ok-qr" id="okCampus">[\s\S]*?<\/div>/);
  assert.ok(campus, '未找到校园云区块');
  assert.match(campus[0], /<img src="campus-qr\.jpg" alt="燚桐校园云小程序码">/);
  assert.match(campus[0], /找兼职、逛树洞、<br>上表白墙，<br>尽在燚桐校园云/);
  assert.ok(campus[0].indexOf('尽在燚桐校园云') < campus[0].indexOf('长按识别小程序码'), '文案应排在长按提示之前');
  assert.match(html, /\.ok-qr-row\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center/);
});

test('推广海报底部绘制校园云专区，小程序码未加载时整条不画', () => {
  assert.match(html, /c\.height = bg\.naturalHeight \+ \(campusImg \? POSTER_CAMPUS\.h \* u : 0\)/); // 没加载就不加高，不出现空白卡片
  assert.match(html, /if \(campusImg\) drawCampus\(x, bg\.naturalHeight, u\)/);
  assert.match(html, /lines: \['兼职·树洞·表白墙', '尽在燚桐校园云', '长按识别小程序码'\]/); // 文案在前、长按提示在后
  assert.match(html, /x\.drawImage\(campusImg, /);
  assert.match(html, /cq\.src = '\.\/campus-qr\.jpg'/);
});

test('海报报名码与邀请码坐标不因校园云专区改变', () => {
  assert.match(html, /var POSTER_QR = \{ x: 148, y: 1264, s: 168 \};/);
  assert.match(html, /var POSTER_CODE = \{ x: 350, y: 1440, w: 310, h: 42, cx: 505, by: 1472 \};/);
});

test('暂停酒店的报名按钮置灰并显示暂停报名', () => {
  assert.match(html, /apply\.textContent = h\.paused \? '暂停报名' : '立即报名'/);
  assert.match(html, /apply\.disabled = !!h\.paused/);
  assert.match(html, /detailApply\.disabled = !!h\.paused/);
  assert.match(html, /detailApply\.textContent = h\.paused \? '暂停报名' : '报名这家酒店'/);
});

test('在招计数剔除暂停酒店', () => {
  assert.match(html, /shown\.filter\(function \(h\) \{ return !h\.paused; \}\)\.length/);
  assert.match(html, /HOTELS\.filter\(function \(h\) \{ return !h\.paused; \}\)\.length/);
});

test('备选酒店为选填下拉，选项排除当前报名酒店和已暂停酒店', () => {
  assert.match(html, /<select id="fBackup"><\/select>/);
  assert.match(html, /<option value="">不填<\/option>/);
  assert.match(html, /HOTELS\.filter\(function \(x\) \{ return x\.name !== h\.name && !x\.paused; \}\)/);
  assert.match(html, /backupHotel: document\.getElementById\('fBackup'\)\.value/);
});
