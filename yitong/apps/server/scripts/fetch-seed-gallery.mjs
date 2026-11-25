/**
 * P2-92 种子配图：从 Wikimedia Commons 搜真实摄影图（公开数据优先，CC 授权体系）。
 * 每个媒体位搜 1 个主题、下载最多 N 张候选到 .seed-media/gallery/<id>-<n>.jpg；
 * 质量抽检后不合适的帖子回退 AI 生成图（.seed-media/<id>.jpg）。
 *
 * 用法：node scripts/fetch-seed-gallery.mjs [仅指定 id，如 c03,t15]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.seed-media', 'gallery');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 媒体位 → Commons 搜索词（英文命中率高；多图帖取 top3，单图帖取 top1-2）
const QUERY = {
  c03: ['malatang', 'chinese street food noodle bowl'],
  c05: ['handwritten notes study desk', 'study notes highlighter'],
  c06: ['university study room empty', 'reading room desk window'],
  c09: ['stadium running track sunset', 'sports field dusk campus'],
  c11: ['orange tabby cat street', 'orange cat sitting campus'],
  c12: ['fried rice plate', 'egg fried rice wok'],
  c13: ['acoustic guitar night street', 'guitar leaning wall'],
  c17: ['bicycle repair shop street', 'bicycle repair tools'],
  c19: ['university library night reading', 'library study lamps night'],
  c21: ['cat sleeping classroom', 'cat sleeping on desk'],
  c22: ['stack of textbooks desk', 'exam review books'],
  c24: ['bicycle shed dormitory', 'bicycles parked campus'],
  c27: ['street lamp night park', 'modern street light evening'],
  c28: ['badminton court indoor', 'badminton racket shuttlecock'],
  c31: ['tuxedo cat street', 'black and white cat'],
  c33: ['egg drop soup bowl', 'chinese soup bowl restaurant'],
  c35: ['secondhand book stall market', 'old books flea market'],
  c37: ['vending machine night street', 'drink vending machine glowing'],
  c40: ['empty classroom night desks', 'lecture hall empty chairs'],
  c41: ['delivery scooter rain street', 'rainy street umbrella night'],
  c45: ['chinese breakfast steamed buns soy milk', 'baozi breakfast'],
  c46: ['flower stall roses street', 'roses bucket flower shop'],
  c48: ['dormitory corridor night window', 'night window warm light building'],
  t01: ['earphones on bed', 'earbuds smartphone desk'],
  t03: ['rain drops window night', 'rainy window city lights'],
  t04: ['spicy hot pot bowl', 'malatang spicy soup'],
  t07: ['laptop screen dark room student', 'computer desk night dormitory'],
  t09: ['kite stuck in tree', 'kite flying park tree'],
  t12: ['tie-dye t-shirt', 'pink t-shirt folded'],
  t15: ['braised beef potatoes bowl', 'chinese stew beef dish'],
  t16: ['hotpot meal overhead', 'chinese hotpot table'],
  t18: ['vocabulary notebook handwriting', 'english notebook study'],
  t21: ['rice porridge breakfast bowl', 'congee chinese breakfast'],
  t23: ['smartphone glow night hands', 'phone chat dark room'],
  t26: ['full moon over buildings night', 'full moon city skyline'],
  t29: ['old book title page handwriting', 'antique book opening page'],
  t30: ['white chrysanthemum vase', 'white flowers windowsill'],
  t32: ['running track night floodlights', 'athletics track night'],
  t36: ['train window night lights', 'bus window night blur'],
  t39: ['cozy sofa plants corner room', 'counseling room interior cozy'],
  t43: ['balcony view dusk city', 'city sunset from balcony'],
  t49: ['mandarin orange close up', 'tangerine on table'],
};

const PER_QUERY = 2; // 每个搜索词下载前 2 张候选
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;

async function searchCommons(query) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=` +
    encodeURIComponent(`${query} filetype:bitmap`) +
    `&gsrnamespace=6&gsrlimit=8&gsrsort=relevance&prop=imageinfo` +
    `&iiprop=url|size|mime&iiurlwidth=800&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data.query?.pages ?? {});
  return pages
    .map((p) => p.imageinfo?.[0])
    .filter((info) => info && /\.(jpe?g|png)$/i.test(info.url || ''))
    .filter((info) => (info.width ?? 0) >= 640 && (info.height ?? 0) >= 420)
    .map((info) => info.thumburl || info.url);
}

async function download(url, file) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`dl HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 15_000) throw new Error(`too small ${buf.length}B`);
  fs.writeFileSync(file, buf);
  return buf.length;
}

const ids = only ? [...only] : Object.keys(QUERY);
let totalOk = 0;
const noResult = [];
for (const id of ids) {
  const terms = QUERY[id];
  let got = 0;
  const seen = new Set();
  try {
    for (const term of terms) {
      if (got >= PER_QUERY + 1) break; // 单帖最多 3 张候选
      let urls = [];
      try {
        urls = await searchCommons(term);
      } catch (e) {
        console.log(`  search fail [${term}]: ${e.message}`);
        continue;
      }
      for (const u of urls) {
        if (got >= PER_QUERY + 1) break;
        if (seen.has(u)) continue;
        seen.add(u);
        const file = path.join(OUT_DIR, `${id}-${got + 1}.jpg`);
        try {
          const size = await download(u, file);
          got += 1;
          totalOk += 1;
          console.log(`ok ${id}-${got} (${(size / 1024).toFixed(0)}KB) <- "${term}"`);
        } catch (e) {
          console.log(`  dl fail [${term}]: ${e.message}`);
        }
      }
      await new Promise((r) => setTimeout(r, 1200)); // 礼貌间隔
    }
  } finally {
    if (got === 0) noResult.push(id);
    console.log(`== ${id}: ${got} 张`);
  }
}
console.log(`\nDONE totalOk=${totalOk} noResult=[${noResult.join(',')}]`);
