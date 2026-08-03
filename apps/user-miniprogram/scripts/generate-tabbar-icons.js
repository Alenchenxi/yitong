// 生成三端 tabBar 线性图标 PNG（81×81，透明底）
// 风格：未选中灰 #86909C / 选中品牌黄 #F9C801，无圆底，线性描边
// 数据源：@tabler/icons（MIT）outline SVG；sharp 栅格化
// 对齐 docs/UI设计规范.md §7 线性图标、§6.5 选中态品牌黄
// 用法（项目根）：node apps/user-miniprogram/scripts/generate-tabbar-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SIZE = 81;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'tabbar');
const ICON_SRC = path.join(__dirname, '..', '..', '..', 'node_modules', '@tabler', 'icons', 'icons', 'outline');

// 文件名 -> Tabler outline 图标名（三端 14 个 tab；user/users 跨端复用同形）
const ICONS = [
  // 用户端（文件名沿用旧名，直接覆盖，app.json tabBar 路径不变）
  { file: 'confession', icon: 'heart' },
  { file: 'treehole', icon: 'moon-stars' },
  { file: 'job', icon: 'briefcase' },
  { file: 'profile', icon: 'user' },
  // 商家端
  { file: 'm-candidates', icon: 'users' },
  { file: 'm-jobs', icon: 'clipboard-list' },
  { file: 'm-post', icon: 'square-rounded-plus' },
  { file: 'm-notifications', icon: 'bell' },
  { file: 'm-profile', icon: 'user' },
  // 管理端
  { file: 'a-dashboard', icon: 'dashboard' },
  { file: 'a-review', icon: 'shield-check' },
  { file: 'a-ops', icon: 'speakerphone' },
  { file: 'a-users', icon: 'users' },
  { file: 'a-profile', icon: 'user' },
];

const COLOR_NORMAL = '#86909C'; // 次文字灰（未选中）
const COLOR_ACTIVE = '#F9C801'; // 品牌黄（选中）

async function render(iconName, color, outFile) {
  const svgPath = path.join(ICON_SRC, `${iconName}.svg`);
  if (!fs.existsSync(svgPath)) throw new Error(`icon not found: ${iconName}.svg`);
  let svg = fs.readFileSync(svgPath, 'utf8');
  // currentColor -> 目标色；强制输出尺寸 81，viewBox 24 不变（矢量栅格化保持清晰）
  svg = svg
    .replace(/currentColor/g, color)
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
    await render(icon, COLOR_NORMAL, path.join(OUT_DIR, `${file}.png`));
    await render(icon, COLOR_ACTIVE, path.join(OUT_DIR, `${file}-active.png`));
    n += 2;
  }
  console.log(`generated ${n} icons in ${OUT_DIR}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
