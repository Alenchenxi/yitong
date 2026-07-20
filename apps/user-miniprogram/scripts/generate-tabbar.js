// 生成 tabBar 图标 png（纯 Node，无依赖）：品牌黄选中态 + 灰色普通态
// 对齐 docs/UI设计规范.md：主色 #F9C801，黄底用深色图案（禁止黄底白字）
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
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[o++] = rgba[i]; raw[o++] = rgba[i + 1]; raw[o++] = rgba[i + 2]; raw[o++] = rgba[i + 3];
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---- 绘制 ----
function newCanvas() { return new Uint8Array(SIZE * SIZE * 4); }
function setPx(px, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
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

// 图案绘制（接收 color 参数）
function drawHeart(px, c) {
  const cx = SIZE / 2, cy = SIZE / 2 + 6, s = 22;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const nx = (x - cx) / s, ny = (cy - y) / s;
      if ((nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny <= 0) setPx(px, x, y, c[0], c[1], c[2]);
    }
}
function drawMoon(px, c) {
  const cx = SIZE / 2, cy = SIZE / 2, r = 22, off = 12;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      const inBig = dx * dx + dy * dy <= r * r;
      const ddx = x - (cx + off), ddy = y - cy;
      const inSmall = ddx * ddx + ddy * ddy <= (r - 4) * (r - 4);
      if (inBig && !inSmall) setPx(px, x, y, c[0], c[1], c[2]);
    }
}
function drawBag(px, c) {
  const cx = SIZE / 2, cy = SIZE / 2 + 4, w = 36, h = 26;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const inBody = x >= cx - w / 2 && x <= cx + w / 2 && y >= cy - h / 2 && y <= cy + h / 2;
      const dx = x - cx, dy = y - (cy - h / 2);
      const inHandle = dx * dx + dy * dy >= 8 * 8 && dx * dx + dy * dy <= 14 * 14 && dy <= 0 && y >= cy - h / 2 - 14;
      if (inBody || inHandle) setPx(px, x, y, c[0], c[1], c[2]);
    }
}
function drawPerson(px, c) {
  const cx = SIZE / 2, cy = SIZE / 2;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - (cy - 12);
      if (dx * dx + dy * dy <= 12 * 12) setPx(px, x, y, c[0], c[1], c[2]);
    }
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - (cy + 24);
      if (dx * dx + dy * dy <= 22 * 22 && dy <= 0 && y >= cy + 6) setPx(px, x, y, c[0], c[1], c[2]);
    }
}

// 颜色：普通态灰圆+白图；选中态品牌黄圆+深色图（黄底禁白字）
const COLOR_NORMAL = [201, 205, 212]; // #C9CDD4 弱灰
const COLOR_ACTIVE = [249, 200, 1];   // #F9C801 品牌黄
const ICON_LIGHT = [255, 255, 255];   // 普通态白图案（灰底白图可读）
const ICON_DARK = [29, 33, 41];       // #1D2129 选中态深图案（黄底深图）

const ICONS = [
  { name: 'confession', draw: drawHeart },
  { name: 'treehole', draw: drawMoon },
  { name: 'job', draw: drawBag },
  { name: 'profile', draw: drawPerson },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const { name, draw } of ICONS) {
  const active = newCanvas();
  fillCircle(active, SIZE / 2, SIZE / 2, SIZE / 2 - 4, COLOR_ACTIVE);
  draw(active, ICON_DARK);
  fs.writeFileSync(path.join(OUT_DIR, `${name}-active.png`), encodePng(SIZE, SIZE, active));

  const normal = newCanvas();
  fillCircle(normal, SIZE / 2, SIZE / 2, SIZE / 2 - 4, COLOR_NORMAL);
  draw(normal, ICON_LIGHT);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), encodePng(SIZE, SIZE, normal));
}
console.log(`generated ${ICONS.length * 2} icons in ${OUT_DIR}`);
