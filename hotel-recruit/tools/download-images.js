// 下载酒店图片：node tools/download-images.js [urls.json]
// 输入格式 {"酒店名": ["直链1", "直链2", ...]}，输出 public/img/酒店名-1.jpg ~ -3.jpg（最多3张）
// 校验图片魔数、过滤小图标；403/防盗链时自动带 Referer 重试
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'public', 'img');
const list = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, 'image-urls.json'), 'utf8'));

function imgKind(buf) {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;                                  // jpeg
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // png
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return true;
  return false;
}

async function grab(url, referer) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };
  if (referer) headers.Referer = referer;
  const r = await fetch(url, { headers, redirect: 'follow' });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (!imgKind(buf) || buf.length < 3000) return null; // 过滤小图标/校验失败
  return buf;
}

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  const report = {};
  for (const [name, urls] of Object.entries(list)) {
    if (!Array.isArray(urls)) { report[name] = 0; continue; }
    const saved = [];
    const seen = new Set(); // 内容去重：同一张图的不同尺寸只留一张
    for (const url of urls) {
      if (saved.length >= 3) break;
      if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue;
      let buf = await grab(url).catch(() => null);
      if (!buf) buf = await grab(url, 'https://www.baidu.com/').catch(() => null); // 防盗链兜底重试
      if (!buf) continue;
      const hash = crypto.createHash('sha1').update(buf).digest('hex');
      if (seen.has(hash)) continue;
      seen.add(hash);
      saved.push(buf);
    }
    saved.forEach((buf, i) => fs.writeFileSync(path.join(IMG, `${name}-${i + 1}.jpg`), buf));
    report[name] = saved.length;
    console.log(`${name}: ${saved.length}张`);
  }
  console.log('----汇总----');
  console.log(JSON.stringify(report));
})();
