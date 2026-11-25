/**
 * P2-92 种子内容媒体生成：调用 Pollinations.AI（免费、无 key、nologo=true 官方无水印参数）
 * 生成 40 张种子配图到 .seed-media/，固定 seed 保证可复现。
 *
 * 用法：node scripts/gen-seed-media.mjs [仅生成指定 id，如 12,19]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.seed-media');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 帖子 id → 英文 prompt（统一 800x600；不生成人物特写；campus-photo 风格词保证真实感）
const STYLE = 'campus life photo, natural lighting, realistic, no people, no text, no watermark';
const IMAGES = [
  { id: 'c03', prompt: `spicy malatang hotpot bowl with steam, close up top view, chinese campus canteen food, ${STYLE}` },
  { id: 'c05', prompt: `open handwritten study notebook with colorful highlighter pens on desk, ${STYLE}` },
  { id: 'c06', prompt: `quiet study room desk by large window, books and lamp, morning light, empty, ${STYLE}` },
  { id: 'c09', prompt: `university sports field at sunset with warm lantern lights, running track, golden sky, ${STYLE}` },
  { id: 'c11', prompt: `a cute orange tabby cat sitting on campus sidewalk near dormitory building, looking at camera, ${STYLE}` },
  { id: 'c12', prompt: `fried rice with egg and scallion on plate, canteen wok cooking, close up, ${STYLE}` },
  { id: 'c13', prompt: `acoustic guitar silhouette leaning against teaching building at night, warm street lamp, ${STYLE}` },
  { id: 'c17', prompt: `small bicycle repair stall at campus south gate, old tools and bicycle wheels, daytime, ${STYLE}` },
  { id: 'c19', prompt: `university library at night, rows of warm desk lamps on study tables through window, ${STYLE}` },
  { id: 'c21', prompt: `orange and white cat sleeping curled up on a classroom podium next to a projector remote, ${STYLE}` },
  { id: 'c22', prompt: `neatly organized exam review notes and textbooks stacked by chapter on desk, ${STYLE}` },
  { id: 'c24', prompt: `bicycle shed outside dormitory building at dusk, rows of bicycles, warm light, ${STYLE}` },
  { id: 'c27', prompt: `brand new modern street lamp on campus road at night, blue evening sky, ${STYLE}` },
  { id: 'c28', prompt: `indoor badminton court with bright lights, racket and shuttlecock on green floor, ${STYLE}` },
  { id: 'c31', prompt: `friendly black and white tuxedo cat meowing in a parking garage, hay food bowl nearby, ${STYLE}` },
  { id: 'c33', prompt: `bowl of seaweed egg drop soup with spoon, canteen table, steam rising, ${STYLE}` },
  { id: 'c35', prompt: `secondhand book stall at campus flea market, textbooks stacked on blanket, graduation season, ${STYLE}` },
  { id: 'c37', prompt: `glowing vending machine at dormitory entrance at night, drinks inside, night scene, ${STYLE}` },
  { id: 'c40', prompt: `empty university classroom at night with ceiling lights on, rows of desks, window reflections, ${STYLE}` },
  { id: 'c41', prompt: `delivery rider with umbrella and food box riding scooter on rainy street, back view, rain drops, ${STYLE}` },
  { id: 'c45', prompt: `chinese breakfast set: steamed buns, soy milk cup and boiled egg on tray, canteen morning, ${STYLE}` },
  { id: 'c46', prompt: `small flower stall at campus gate with red roses in buckets, warm afternoon, ${STYLE}` },
  { id: 'c48', prompt: `dormitory caretaker room window with warm light at night, small counter with thermos, ${STYLE}` },
  { id: 't01', prompt: `earphones and smartphone on dormitory bed pillow, early morning light through curtain, ${STYLE}` },
  { id: 't03', prompt: `rain drops sliding down dark window glass at night, city lights bokeh outside, melancholy mood, ${STYLE}` },
  { id: 't04', prompt: `extremely spicy malatang red broth bowl with chili oil, close up, steam, ${STYLE}` },
  { id: 't07', prompt: `laptop screen showing course selection website with red full marks warning, dim dormitory room, ${STYLE}` },
  { id: 't09', prompt: `colorful kite stuck in big tree beside sports field, students ladder in background distance, ${STYLE}` },
  { id: 't12', prompt: `white t-shirt turned pink tie-dye folded on washing machine, laundry room, ${STYLE}` },
  { id: 't15', prompt: `braised beef with potatoes in canteen tray bowl, rich brown gravy, close up, ${STYLE}` },
  { id: 't16', prompt: `hotpot in dormitory room on small table, overhead view, steam rising, cozy, ${STYLE}` },
  { id: 't18', prompt: `vocabulary notebook filled with handwritten english words, pen resting on page, desk lamp, ${STYLE}` },
  { id: 't21', prompt: `thick white rice porridge with steamed buns breakfast tray, morning canteen, steam, ${STYLE}` },
  { id: 't23', prompt: `hand holding smartphone with chat app at night, screen glow on face area blurred, dark bed, ${STYLE}` },
  { id: 't26', prompt: `bright full moon over university library rooftop at night, deep blue sky, few stars, ${STYLE}` },
  { id: 't29', prompt: `old book title page with handwritten name and dedication in ink, warm lamp light, ${STYLE}` },
  { id: 't30', prompt: `white chrysanthemum flowers in vase on windowsill, soft grey daylight, memorial mood, ${STYLE}` },
  { id: 't32', prompt: `empty running track at night with bright stadium lights, lane lines, night running, ${STYLE}` },
  { id: 't36', prompt: `earphones on car window seat at night, blurred city lights outside window, melancholy, ${STYLE}` },
  { id: 't39', prompt: `cozy counseling room corner with green sofa, plants and soft warm lamp, empty, calming, ${STYLE}` },
  { id: 't43', prompt: `city dusk view from apartment balcony railing, warm sunset gradient sky, ${STYLE}` },
  { id: 't49', prompt: `a single mandarin orange on canteen table, close up, warm light, ${STYLE}` },
];

const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const targets = only ? IMAGES.filter((i) => only.has(i.id)) : IMAGES;
// 免费匿名档有速率限制（并发 5 会间歇 402），串行慢速磨
const concurrency = 1;
const gapMs = 25_000;
let done = 0;
const failed = [];

async function fetchImage(item, attempt = 1) {
  const file = path.join(OUT_DIR, `${item.id}.jpg`);
  if (fs.existsSync(file) && fs.statSync(file).size > 20_000) {
    done += 1;
    console.log(`skip ${item.id} (exists)`);
    return;
  }
  // 默认模型（sana）免费无水印；flux/turbo 已转付费（HTTP 402）
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.prompt)}?width=800&height=600&seed=2900${Math.abs(hashCode(item.id)) % 900}&nologo=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 20_000) throw new Error(`too small: ${buf.length}B`);
    fs.writeFileSync(file, buf);
    done += 1;
    console.log(`ok ${item.id} (${(buf.length / 1024).toFixed(0)}KB) ${done}/${targets.length}`);
  } catch (e) {
    if (attempt < 4) {
      const backoff = 30_000 * attempt;
      console.log(`retry ${item.id} in ${backoff / 1000}s (attempt ${attempt}: ${e.message})`);
      await new Promise((r) => setTimeout(r, backoff));
      return fetchImage(item, attempt + 1);
    }
    failed.push(item.id);
    console.error(`FAIL ${item.id}: ${e.message}`);
  }
}

function hashCode(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

const queue = [...targets];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      await fetchImage(item);
      if (queue.length > 0) await new Promise((r) => setTimeout(r, gapMs));
    }
  }),
);
console.log(`\nDONE done=${done} failed=${failed.length}${failed.length ? ' ids=' + failed.join(',') : ''}`);
process.exit(failed.length > 0 ? 1 : 0);
