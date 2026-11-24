/**
 * P2-92 表白墙内容全圈自动同步 独立 smoke（需本地 server + 已执行本次迁移的 postgres）
 *
 * 覆盖契约（逐项断言）：
 * 1. 普通用户（非平台管理员）发表白墙帖成功——不被 posts_publication_scope_check 拒（50000）
 * 2. 落库 publisher_scope='COMMUNITY' + visibility_scope='ALL_COMMUNITIES'；约束仍禁止 PLATFORM + COMMUNITY
 * 3. 跨圈可见：另一圈子成员在表白墙 feed / 详情 / 广场混合流 / 今日上头均可见该帖
 * 4. 存量圈子帖（visibility_scope='COMMUNITY'，未回填）仍仅归属圈子可见：他圈 feed/详情/广场/今日上头均不可见
 * 5. 动态数：全圈帖计入每个圈子，存量圈子帖只计入归属圈
 *
 * 环境适配：起 server 须带 `WX_USER_APPID= WX_USER_SECRET=` 空值前缀强制 mock 内容审核；
 * prisma 直建测试 user / 圈子 / 发帖分类，手签 HS256 JWT（JWT_SECRET 从 .env 读）绕过微信登录。
 *
 * 用法（DATABASE_URL 须与 server 同库）：
 *   cd <worktree>/apps/server
 *   BASE_URL=http://localhost:3014/api/v1 DATABASE_URL=... node scripts/smoke-p2-92-confession-all-communities.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const SERVER_DIR = process.env.SERVER_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(key) {
  const envPath = path.join(SERVER_DIR, '.env');
  if (!fs.existsSync(envPath)) return null;
  const env = fs.readFileSync(envPath, 'utf8');
  const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!m) return null;
  let val = m[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

const DB = process.env.DATABASE_URL || readEnv('DATABASE_URL');
if (!DB) {
  console.error('缺少 DATABASE_URL（环境变量或 apps/server/.env）：本脚本拒绝对未指定的库执行写操作');
  process.exit(2);
}

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// 手签 HS256 JWT，兼容 @nestjs/jwt JwtService.verifyAsync
function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 7200 };
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(fullPayload))}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

async function call(method, pathUrl, token, body) {
  const response = await fetch(`${BASE}${pathUrl}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // 保留非 JSON 响应，断言时报告 status。
  }
  return { status: response.status, body: json };
}

function assert(condition, message, evidence = '') {
  if (!condition) {
    const suffix = evidence ? ` | ${evidence}` : '';
    console.error(`  ✗ ${message}${suffix}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}${evidence ? ` | ${evidence}` : ''}`);
}

function assertEq(actual, expected, message) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  assert(actualText === expectedText, message, `expected=${expectedText} actual=${actualText}`);
}

(async () => {
  console.log('[P2-92 smoke] BASE =', BASE);
  const marker = `p292_${Date.now().toString(36)}`;
  const jwtSecret = readEnv('JWT_SECRET') || 'dev-secret-change-me';
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

  const openids = [`mock_p292a_${marker}`, `mock_p292b_${marker}`];
  const content = (label) => `P292_${label}_${marker}`;
  const userIds = [];
  const communityIds = [];
  let circleId = null;

  const cleanup = async () => {
    console.log('\n[cleanup] 开始清理本 smoke 创建的数据...');
    const posts = await prisma.post.findMany({
      where: { content: { startsWith: 'P292_' }, authorId: { in: userIds } },
      select: { id: true },
    });
    const postIds = posts.map((row) => row.id);
    await prisma.contentView.deleteMany({ where: postIds.length > 0 ? { targetId: { in: postIds } } : { id: { in: [] } } });
    await prisma.post.deleteMany({ where: { id: { in: postIds } } });
    await prisma.circle.deleteMany({ where: { name: { startsWith: 'P292_' } } });
    await prisma.community.deleteMany({ where: { id: { in: communityIds } } }); // 成员关系级联
    await prisma.userRole.deleteMany({ where: userIds.length > 0 ? { userId: { in: userIds } } : { id: { in: [] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    // 逐表自验证：确认无测试残留
    const remain = {
      users: await prisma.user.count({ where: { openid: { in: openids } } }),
      user_roles: await prisma.userRole.count({ where: userIds.length > 0 ? { userId: { in: userIds } } : { id: { in: [] } } }),
      communities: await prisma.community.count({ where: { id: { in: communityIds } } }),
      posts: await prisma.post.count({ where: { content: { startsWith: 'P292_' } } }),
      content_views: await prisma.contentView.count({ where: postIds.length > 0 ? { targetId: { in: postIds } } : { id: { in: [] } } }),
      circles: await prisma.circle.count({ where: { name: { startsWith: 'P292_' } } }),
    };
    for (const [table, count] of Object.entries(remain)) {
      assert(count === 0, `清理自验证 ${table}=0`, `remain=${count}`);
    }
    console.log('[cleanup] 清理完成并逐表自验证为 0');
  };

  // 直建测试 user（绕过微信登录）并签发 JWT
  const createUser = async (openid, nickname) => {
    const user = await prisma.user.create({ data: { openid, unionid: null, nickname, avatarUrl: null } });
    userIds.push(user.id);
    await prisma.userRole.create({ data: { userId: user.id, role: 'USER' } });
    return { user, token: signJwt({ uid: user.id, role: 'USER', openid, type: 'access' }, jwtSecret) };
  };
  // 取某用户视角下的帖子 id 列表（表白墙 feed 取 PostVo.id；广场/今日上头取 kind=post 的 data.id）
  const visiblePostIds = async (token, pathUrl) => {
    const resp = await call('GET', pathUrl, token);
    assert(resp.body?.code === 0, `GET ${pathUrl} 成功`, JSON.stringify(resp.body));
    return resp.body.data.list.map((item) => item.kind ? item.data.id : item.id);
  };
  const communityPostCounts = async (token) => {
    const resp = await call('GET', '/community/list', token);
    assert(resp.body?.code === 0, 'GET /community/list 成功', JSON.stringify(resp.body));
    const byId = new Map(resp.body.data.map((c) => [c.id, c.postCount]));
    return communityIds.map((id) => byId.get(id));
  };

  try {
    // ===== 夹具：A 是圈子 C1 成员，B 是圈子 C2 成员（互不在对方圈子），均为普通用户 =====
    const a = await createUser(openids[0], `P292用户A_${marker}`);
    const b = await createUser(openids[1], `P292用户B_${marker}`);
    const [c1, c2] = await Promise.all([
      prisma.community.create({ data: { name: `P292圈A_${marker}`, memberCount: 1 } }),
      prisma.community.create({ data: { name: `P292圈B_${marker}`, memberCount: 1 } }),
    ]);
    communityIds.push(c1.id, c2.id);
    await prisma.communityMember.createMany({
      data: [
        { communityId: c1.id, userId: a.user.id, role: 'OWNER' },
        { communityId: c2.id, userId: b.user.id, role: 'OWNER' },
      ],
    });
    await Promise.all([
      prisma.user.update({ where: { id: a.user.id }, data: { activeCommunityId: c1.id } }),
      prisma.user.update({ where: { id: b.user.id }, data: { activeCommunityId: c2.id } }),
    ]);
    const circle = await prisma.circle.create({ data: { name: `P292_分类_${marker}` } });
    circleId = circle.id;
    const me = await call('GET', '/auth/me', a.token);
    assert(me.status === 200 && me.body?.code === 0, 'JWT 签发可用：GET /auth/me 成功', JSON.stringify(me.body));

    // ===== 契约点5 基线：发帖前两个圈子的动态数 =====
    const [baseC1, baseC2] = await communityPostCounts(b.token);

    // ===== 契约点1+2：普通用户发帖 + 落库 =====
    console.log('\n[契约点1] 普通用户发表白墙帖');
    const created = await call('POST', `/circles/${circleId}/posts`, a.token, { content: content('新帖') });
    assert(created.body?.code === 0, '普通用户发表白墙帖成功（未被 posts_publication_scope_check 拒）', `status=${created.status} ${JSON.stringify(created.body)}`);
    const newId = created.body.data.id;
    const newRow = await prisma.post.findUnique({
      where: { id: newId },
      select: { publisherScope: true, visibilityScope: true, communityId: true },
    });
    assertEq(newRow, { publisherScope: 'COMMUNITY', visibilityScope: 'ALL_COMMUNITIES', communityId: c1.id }, '落库：COMMUNITY 发布者 + ALL_COMMUNITIES 可见范围');

    // 约束：PLATFORM + COMMUNITY 组合仍被数据库拒绝
    let constraintRejected = false;
    try {
      await prisma.post.create({
        data: { circleId, communityId: c1.id, authorId: a.user.id, content: content('非法'), images: [], publisherScope: 'PLATFORM', visibilityScope: 'COMMUNITY' },
      });
    } catch {
      constraintRejected = true;
    }
    assert(constraintRejected, '约束：PLATFORM 发布者 + COMMUNITY 可见范围仍被数据库拒绝');

    // 存量圈子帖（改造前的形态，未回填）：直接落库
    const legacy = await prisma.post.create({
      data: { circleId, communityId: c1.id, authorId: a.user.id, content: content('老帖'), images: [], status: 'APPROVED' },
    });
    assertEq([legacy.publisherScope, legacy.visibilityScope], ['COMMUNITY', 'COMMUNITY'], '存量圈子帖形态：COMMUNITY 发布者 + COMMUNITY 可见范围');

    // ===== 契约点3+4：跨圈可见 / 存量帖仍限归属圈 =====
    console.log('\n[契约点3/4] 跨圈可见性（B 在圈 C2，帖子归属圈 C1）');
    const feedA = await visiblePostIds(a.token, '/posts/feed?limit=50&sort=latest');
    const feedB = await visiblePostIds(b.token, '/posts/feed?limit=50&sort=latest');
    assert(feedA.includes(newId) && feedA.includes(legacy.id), '归属圈成员的表白墙 feed 同时可见新帖与存量帖');
    assert(feedB.includes(newId), '他圈成员的表白墙 feed 可见全圈新帖');
    assert(!feedB.includes(legacy.id), '他圈成员的表白墙 feed 不可见存量圈子帖');

    const detailB = await call('GET', `/posts/${newId}`, b.token); // 同时产生浏览量，供今日上头
    assert(detailB.body?.code === 0, '他圈成员可访问全圈新帖详情');
    const detailLegacyB = await call('GET', `/posts/${legacy.id}`, b.token);
    assert(detailLegacyB.body?.code !== 0, '他圈成员访问存量帖详情被拒', JSON.stringify(detailLegacyB.body));
    const detailLegacyA = await call('GET', `/posts/${legacy.id}`, a.token); // 归属圈成员浏览 → 今日上头候选
    assert(detailLegacyA.body?.code === 0, '归属圈成员可访问存量帖详情');

    const squareB = await visiblePostIds(b.token, '/square/feed?limit=50&sort=latest');
    assert(squareB.includes(newId), '他圈成员的广场混合流可见全圈新帖');
    assert(!squareB.includes(legacy.id), '他圈成员的广场混合流不可见存量圈子帖');

    // 存量帖即使被他圈用户浏览过，也不进他圈的今日上头
    await prisma.contentView.create({
      data: { targetType: 'post', targetId: legacy.id, viewerKey: b.user.id, hourBucket: Math.floor(Date.now() / 3_600_000) },
    });
    // 浏览量埋点是 fire-and-forget，轮询等待今日上头出现
    let hitB = [];
    let hitA = [];
    for (let i = 0; i < 10; i++) {
      hitB = await visiblePostIds(b.token, '/square/today-hit?limit=50');
      hitA = await visiblePostIds(a.token, '/square/today-hit?limit=50');
      if (hitB.includes(newId) && hitA.includes(legacy.id)) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert(hitB.includes(newId), '他圈成员的今日上头含全圈新帖');
    assert(!hitB.includes(legacy.id), '他圈成员的今日上头不含存量圈子帖');
    assert(hitA.includes(legacy.id), '归属圈成员的今日上头含存量圈子帖');

    // ===== 契约点5：动态数 =====
    console.log('\n[契约点5] 动态数：全圈帖计入每个圈子，存量圈子帖只计归属圈');
    const [afterC1, afterC2] = await communityPostCounts(b.token);
    assertEq([afterC1 - baseC1, afterC2 - baseC2], [2, 1], 'C1 动态数 +2（新帖+存量帖），C2 动态数 +1（仅全圈新帖）');

    console.log('\n[P2-92 smoke] 全部契约点通过');
  } catch (error) {
    console.error('\n[P2-92 smoke] 失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      console.error('[cleanup] 清理失败：', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }
})();
