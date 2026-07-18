// 生成 tabBar 图标 png（纯 Node，无依赖）：彩色圆背景 + 白色图案
// 用法：node apps/user-miniprogram/scripts/generate-tabbar.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 81;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tabbar');

// ---- CRC32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const tb = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[o++] = rgba[i]; raw[o++] = rgba[i + 1]; raw[o++] = rgba[i + 2]; raw[o++] = rgba[i + 3];
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 绘制 ----
function newCanvas() {
  return new Uint8Array(SIZE * SIZE * 4); // 全透明
}
function setPx(px, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // alpha 混合
  const sa = a / 255, da = px[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return;
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / outA);
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / outA);
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / outA);
  px[i + 3] = Math.round(outA * 255);
}
function fillCircle(px, cx, cy, r, col) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPx(px, x, y, col[0], col[1], col[2]);
    }
}
const WHITE = [255, 255, 255];

// 心形（表白墙）
function drawHeart(px) {
  const cx = SIZE / 2, cy = SIZE / 2 + 6, s = 22;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const nx = (x - cx) / s, ny = (cy - y) / s; // y 翻转，尖朝下
      const v = (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny;
      if (v <= 0) setPx(px, x, y, WHITE[0], WHITE[1], WHITE[2]);
    }
}
// 月牙（树洞）
function drawMoon(px) {
  const cx = SIZE / 2, cy = SIZE / 2, r = 22;
  const off = 12;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      const inBig = dx * dx + dy * dy <= r * r;
      const ddx = x - (cx + off), ddy = y - cy;
      const inSmall = ddx * ddx + ddy * ddy <= (r - 4) * (r - 4);
      if (inBig && !inSmall) setPx(px, x, y, WHITE[0], WHITE[1], WHITE[2]);
    }
}
// 公文包（兼职）
function drawBag(px) {
  const cx = SIZE / 2, cy = SIZE / 2 + 4, w = 36, h = 26;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const inBody = x >= cx - w / 2 && x <= cx + w / 2 && y >= cy - h / 2 && y <= cy + h / 2;
      // 手柄（顶部弧）
      const dx = x - cx, dy = y - (cy - h / 2);
      const inHandle = dx * dx + dy * dy >= 8 * 8 && dx * dx + dy * dy <= 14 * 14 && dy <= 0 && y >= cy - h / 2 - 14;
      if (inBody || inHandle) setPx(px, x, y, WHITE[0], WHITE[1], WHITE[2]);
    }
}
// 人头（我的）
function drawPerson(px) {
  const cx = SIZE / 2, cy = SIZE / 2;
  // 头：圆
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - (cy - 12);
      if (dx * dx + dy * dy <= 12 * 12) setPx(px, x, y, WHITE[0], WHITE[1], WHITE[2]);
    }
  // 身体：半圆（肩膀）
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - (cy + 24);
      if (dx * dx + dy * dy <= 22 * 22 && dy <= 0 && y >= cy + 6) setPx(px, x, y, WHITE[0], WHITE[1], WHITE[2]);
    }
}

const ICONS = [
  { name: 'confession', color: [255, 77, 109], draw: drawHeart },
  { name: 'treehole', color: [124, 77, 255], draw: drawMoon },
  { name: 'job', color: [24, 144, 255], draw: drawBag },
  { name: 'profile', color: [82, 196, 26], draw: drawPerson },
];
const GRAY = [153, 153, 153];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const { name, color, draw } of ICONS) {
  // 选中态：彩色圆 + 白色图案
  const active = newCanvas();
  fillCircle(active, SIZE / 2, SIZE / 2, SIZE / 2 - 4, color);
  draw(active);
  fs.writeFileSync(path.join(OUT_DIR, `${name}-active.png`), encodePng(SIZE, SIZE, active));
  // 普通态：灰色圆 + 白色图案
  const normal = newCanvas();
  fillCircle(normal, SIZE / 2, SIZE / 2, SIZE / 2 - 4, GRAY);
  draw(normal);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), encodePng(SIZE, SIZE, normal));
}
console.log(`generated ${ICONS.length * 2} icons in ${OUT_DIR}`);
