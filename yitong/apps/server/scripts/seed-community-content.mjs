/**
 * P2-92 种子内容入库：表白墙 50 条 + 树洞 50 条（用户已确认文本），三天分布 20/20/10。
 * 媒体：.seed-media/gallery/<id>-N.jpg（Wikimedia 真实图，优先）→ .seed-media/<id>.jpg（AI 图，兜底）→ 纯文字。
 * 幂等：content 已存在则跳过，可重复执行。清理标记：用户 openid 前缀 seed_content_。
 *
 * 用法（cwd=apps/server，DATABASE_URL/MINIO_* 从 .env 读）：
 *   node scripts/seed-community-content.mjs [--dry-run] [--days-back 0]
 *   环境变量 MEDIA_BASE_URL：跳过上传，直接用该前缀拼对象 key 作为图片 URL（供离线/占位场景）
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROOT = SERVER_DIR;
const MEDIA_DIR = path.join(ROOT, '.seed-media');
const GALLERY_DIR = path.join(MEDIA_DIR, 'gallery');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const daysBackArg = args.includes('--days-back') ? Number(args[args.indexOf('--days-back') + 1]) : 0;

function readEnv(key) {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return null;
  const m = fs.readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const DB = process.env.DATABASE_URL || readEnv('DATABASE_URL');
if (!DB) {
  console.error('缺少 DATABASE_URL');
  process.exit(2);
}

// 固定 seed 伪随机（复现：同参数跑两次时间戳秒数一致）
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261125);

const CONFESSION_USERS = [
  { openid: 'seed_content_u1', nickname: '南风知我意' },
  { openid: 'seed_content_u2', nickname: '今天也想吃糖' },
  { openid: 'seed_content_u3', nickname: 'Yzz_' },
  { openid: 'seed_content_u4', nickname: '暴走小圆' },
];
const TREEHOLE_USERS = [
  { openid: 'seed_content_u5', anonNickname: '橘子汽水' },
  { openid: 'seed_content_u6', anonNickname: '一只咸鱼' },
  { openid: 'seed_content_u7', anonNickname: '睡前碎碎念' },
  { openid: 'seed_content_u8', anonNickname: '无名懒癌' },
];

// tags → 表白墙分类（seed.ts 的 5 个 Circle）
function pickCircle(tags) {
  const joined = (tags || []).join('');
  if (joined.includes('表白') || /心动|匿名投稿：表白/.test(joined)) return '表白';
  if (/失物|寻物|寻人|寻猫|拼车/.test(joined)) return '失物招领';
  if (joined.includes('学习')) return '学习交流';
  return '日常闲聊';
}

function assertGap(times, label) {
  for (let i = 1; i < times.length; i++) {
    const gap = times[i].getTime() - times[i - 1].getTime();
    if (gap < 10 * 60 * 1000) {
      throw new Error(`${label} 第 ${i - 1}→${i} 条间隔仅 ${Math.round(gap / 60000)} 分钟（<10 分钟约束）`);
    }
  }
}

function buildTimes(entries, baseDate) {
  const times = entries.map((e) => {
    const [h, m] = e.t.split(':').map(Number);
    const sec = Math.floor(rand() * 60); // 有零有整：随机秒
    const d = new Date(baseDate);
    d.setHours(h, m, sec, 0);
    return d;
  });
  assertGap(times, `${baseDate.toDateString()}`);
  return times;
}

async function main() {
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'seed-content.json'), 'utf8'));
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

  // MinIO 客户端（可选：凭证缺失时跳过媒体）
  let minio = null;
  let bucket = readEnv('MINIO_BUCKET') || 'yitong';
  let publicUrl = readEnv('MINIO_PUBLIC_URL') || '';
  const ep = readEnv('MINIO_ENDPOINT');
  const ak = readEnv('MINIO_ACCESS_KEY');
  const sk = readEnv('MINIO_SECRET_KEY');
  const useSsl = readEnv('MINIO_USE_SSL') === 'true';
  const [endPoint, portRaw] = (ep || '').split(':');
  const port = Number(portRaw) || (useSsl ? 443 : 9000);
  if (ep && ak && sk && !DRY_RUN) {
    const { Client } = await import('minio');
    minio = new Client({ endPoint, port, useSSL: useSsl, accessKey: ak, secretKey: sk });
  } else if (!DRY_RUN) {
    console.log('[seed] MinIO 未配置完整：帖子一律纯文字入库');
  }

  const baseUrl = daysBackArg > 0
    ? new Date(Date.now() - daysBackArg * 86400000)
    : new Date();
  const baseDate = (offset) => {
    const d = new Date(baseUrl);
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // ===== 夹具：8 个种子用户（清理标记 openid 前缀 seed_content_）=====
  const userIds = {};
  for (const u of [...CONFESSION_USERS, ...TREEHOLE_USERS]) {
    let user = await prisma.user.findUnique({ where: { openid: u.openid } });
    if (!user) {
      user = await prisma.user.create({
        data: { openid: u.openid, unionid: null, nickname: u.nickname ?? u.anonNickname, avatarUrl: null, activeCommunityId: 'cm_default' },
      });
    }
    userIds[u.openid] = user.id;
  }
  // 树洞匿名档案（anonId = anon_<32hex>，红线：不含真实 uid）
  const anonIds = {};
  for (const u of TREEHOLE_USERS) {
    const uid = userIds[u.openid];
    let profile = await prisma.anonymousProfile.findUnique({ where: { userId: uid } });
    if (!profile) {
      const anonId = `anon_${crypto.randomBytes(16).toString('hex')}`;
      profile = await prisma.anonymousProfile.create({
        data: { userId: uid, anonId, nickname: u.anonNickname, avatar: null },
      });
    }
    anonIds[u.openid] = profile.anonId;
  }
  const circles = await prisma.circle.findMany();
  const circleByName = new Map(circles.map((c) => [c.name, c.id]));
  const defaultCircleId = circles[0]?.id;
  console.log(`[seed] 夹具就绪：${Object.keys(userIds).length} 用户 / ${circles.length} 分类；dryRun=${DRY_RUN}`);

  // ===== 媒体解析：gallery 真实图优先 → AI 图兜底 → 纯文字 =====
  function mediaFiles(id) {
    const files = [];
    for (let n = 1; n <= 3; n++) {
      const g = path.join(GALLERY_DIR, `${id}-${n}.jpg`);
      if (fs.existsSync(g)) files.push(g);
    }
    if (files.length === 0) {
      const ai = path.join(MEDIA_DIR, `${id}.jpg`);
      if (fs.existsSync(ai)) files.push(ai);
    }
    return files;
  }
  const mediaUrlCache = new Map();
  async function mediaUrls(id) {
    if (mediaUrlCache.has(id)) return mediaUrlCache.get(id);
    const files = mediaFiles(id);
    const urls = [];
    for (const f of files) {
      if (DRY_RUN) { urls.push(`(dryrun)${path.basename(f)}`); continue; }
      if (!minio) break;
      const key = `posts/seed-content/${path.basename(f)}`;
      const url = `${publicUrl}/${bucket}/${key}`;
      try {
        const stat = fs.statSync(f);
        await minio.putObject(bucket, key, fs.readFileSync(f), stat.size, { 'Content-Type': 'image/jpeg' });
        urls.push(url);
      } catch (e) {
        console.log(`  media upload fail ${path.basename(f)}: ${e.message}`);
      }
    }
    mediaUrlCache.set(id, urls);
    return urls;
  }

  // ===== 内容入库 =====
  let createdC = 0;
  let skippedC = 0;
  const confEntryIds = []; // confession 全局编号 1..50 → c01..c50
  for (const [dayIdx, dayKey] of ['d0', 'd1', 'd2'].entries()) {
    const entries = content.confession[dayKey] ?? [];
    const times = buildTimes(entries, baseDate(dayIdx));
    for (const [i, e] of entries.entries()) {
      const seq = confEntryIds.length + 1;
      const id = `c${String(seq).padStart(2, '0')}`;
      confEntryIds.push(id);
      const exists = await prisma.post.findFirst({ where: { content: e.content }, select: { id: true } });
      if (exists) { skippedC += 1; continue; }
      const author = CONFESSION_USERS[seq % CONFESSION_USERS.length];
      const circleId = circleByName.get(pickCircle(e.tags)) ?? defaultCircleId;
      const images = await mediaUrls(id);
      if (DRY_RUN) { createdC += 1; continue; }
      await prisma.post.create({
        data: {
          circleId,
          communityId: 'cm_default',
          authorId: userIds[author.openid],
          content: e.content,
          images,
          tags: e.tags ?? [],
          isAnonymous: (e.tags ?? []).includes('匿名'),
          anonName: (e.tags ?? []).includes('匿名') ? '匿名同学' : null,
          status: 'APPROVED',
          publisherScope: 'COMMUNITY',
          visibilityScope: 'ALL_COMMUNITIES',
          visibility: 'PUBLIC',
          likeCount: 12 + Math.floor(rand() * 110),
          viewCount: 120 + Math.floor(rand() * 700),
          createdAt: times[i],
          updatedAt: times[i],
        },
      });
      createdC += 1;
    }
  }

  let createdT = 0;
  let skippedT = 0;
  const treeEntryIds = [];
  for (const [dayIdx, dayKey] of ['d0', 'd1', 'd2'].entries()) {
    const entries = content.treehole[dayKey] ?? [];
    const times = buildTimes(entries, baseDate(dayIdx));
    for (const [i, e] of entries.entries()) {
      const seq = treeEntryIds.length + 1;
      const id = `t${String(seq).padStart(2, '0')}`;
      treeEntryIds.push(id);
      const exists = await prisma.anonymousPost.findFirst({ where: { content: e.content }, select: { id: true } });
      if (exists) { skippedT += 1; continue; }
      const author = TREEHOLE_USERS[seq % TREEHOLE_USERS.length];
      const images = await mediaUrls(id);
      if (DRY_RUN) { createdT += 1; continue; }
      await prisma.anonymousPost.create({
        data: {
          communityId: 'cm_default',
          anonId: anonIds[author.openid],
          content: e.content,
          images,
          mood: e.mood ?? null,
          status: 'APPROVED',
          visibility: 'PUBLIC',
          publisherScope: 'COMMUNITY',
          visibilityScope: 'ALL_COMMUNITIES',
          likeCount: 8 + Math.floor(rand() * 90),
          viewCount: 150 + Math.floor(rand() * 900),
          createdAt: times[i],
          updatedAt: times[i],
        },
      });
      createdT += 1;
    }
  }

  console.log(`\n[seed] 表白墙 created=${createdC} skipped=${skippedC}；树洞 created=${createdT} skipped=${skippedT}`);
  if (DRY_RUN) console.log('[seed] dry-run：未写库');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[seed] 失败：', e);
  process.exit(1);
});
