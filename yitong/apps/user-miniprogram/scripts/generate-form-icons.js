// 生成报名表单构建器功能按钮图标 PNG（64×64，透明底）
// 风格：主色深 #C59A00 线性描边（按钮自带主色 #F9C801 外框，见 publish/index.wxss .ff-btn）
// 数据源：@tabler/icons（MIT）outline SVG；sharp 栅格化（与 generate-tabbar-icons.js 同管线）
// 用法（项目根）：node apps/user-miniprogram/scripts/generate-form-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 64;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
const ICON_SRC = path.join(__dirname, '..', '..', '..', 'node_modules', '@tabler', 'icons', 'icons', 'outline');

const ICONS = [
  { file: 'form-up', icon: 'arrow-up' },
  { file: 'form-down', icon: 'arrow-down' },
  { file: 'form-trash', icon: 'trash' },
  { file: 'form-plus', icon: 'plus' },
  { file: 'form-required', icon: 'asterisk' },
];

const COLOR = '#C59A00'; // 主色深（白底可读，与主色外框同族）

async function render(iconName, outFile) {
  const svgPath = path.join(ICON_SRC, `${iconName}.svg`);
  if (!fs.existsSync(svgPath)) throw new Error(`icon not found: ${iconName}.svg`);
  let svg = fs.readFileSync(svgPath, 'utf8');
  svg = svg
    .replace(/currentColor/g, COLOR)
    .replace(/width="24"/, `width="${SIZE}"`)
    .replace(/height="24"/, `height="${SIZE}"`);
  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outFile);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let n = 0;
  for (const { file, icon } of ICONS) {
    await render(icon, path.join(OUT_DIR, `${file}.png`));
    n += 1;
  }
  console.log(`generated ${n} icons -> ${OUT_DIR}`);
})();
