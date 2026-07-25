/**
 * Admin tail-2 smoke (feat/admin-tail-2).
 *
 * Covers:
 *   1 anon-tag name: server-side trim + explicit 1..12 length check (BizException 30004)
 *     on both create and update.
 *   2 admin comment list: filter by exact authorId, omitting authorId returns unfiltered.
 *   3 (frontend only — verified via static grep, not in this smoke.)
 *
 * Prerequisites: PostgreSQL/Redis are running and the Nest server is already
 * listening (for example, `npx nest start` from apps/server).
 *
 * Usage from the repository root:
 *   node apps/server/scripts/smoke-admin-tail2.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';

let pass = 0;
let fail = 0;
function assert(condition, message) {
  if (!condition) {
    fail += 1;
    console.log(`  X FAIL: ${message}`);
  } else {
    pass += 1;
    console.log(`  + PASS: ${message}`);
  }
}

async function parseResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`非 JSON 响应: HTTP ${response.status}`);
  }
  if (response.status === 429 || body?.code === 90001) {
    const error = new Error('API_429');
    error.code = 'API_429';
    throw error;
  }
  return { status: response.status, body };
}

async function call(method, path, token, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(response);
}

async function login(code, nickname, role = 'user') {
  const response = await fetch(`${BASE}/auth/wx-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, role, nickname }),
  });
  const result = await parseResponse(response);
  if (result.body.code !== 0) {
    throw new Error(`登录失败(${role}): ${JSON.stringify(result.body)}`);
  }
  return result.body.data;
}

function suffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Returns true if a response message contains the requested substring.
function msgContains(body, needle) {
  const m = body?.message;
  if (typeof m === 'string') return m.includes(needle);
  if (Array.isArray(m)) return m.some((s) => typeof s === 'string' && s.includes(needle));
  return false;
}

async function main() {
  console.log(`[admin-tail2 smoke] base = ${BASE}`);
  const run = suffix();
  const user = await login(`tail2U_${run}`, `TailUser2_${run}`, 'user');
  const admin = await login('admin', '管理员', 'admin');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    // =============================================================
    // 1. AnonTag.name length validation.
    // =============================================================
    console.log('\n[1] AnonTag.name 显式长度校验 (create + update)');
    // 1a: create with 13 chars -> must fail.
    const tooLong = 'A'.repeat(13);
    const tooLongCreated = await call('POST', '/admin/anon-tags', admin.accessToken, {
      name: tooLong,
      category: 'mood',
    });
    assert(
      tooLongCreated.body.code !== 0,
      `createAnonTag(13 chars) code !== 0 got code=${tooLongCreated.body.code} msg=${JSON.stringify(tooLongCreated.body.message)}`,
    );
    assert(
      tooLongCreated.body.code === 30004 || msgContains(tooLongCreated.body, '12 字符') || msgContains(tooLongCreated.body, '长度'),
      `createAnonTag(13 chars) 应触发服务层 30004 "标签名长度需在 1-12 字符之间" got code=${tooLongCreated.body.code} msg=${JSON.stringify(tooLongCreated.body.message)}`,
    );

    // 1b: empty name -> must fail.
    const emptyCreated = await call('POST', '/admin/anon-tags', admin.accessToken, {
      name: '',
      category: 'mood',
    });
    assert(
      emptyCreated.body.code !== 0,
      `createAnonTag("") code !== 0 got code=${emptyCreated.body.code} msg=${JSON.stringify(emptyCreated.body.message)}`,
    );

    // 1c: padded "  spaced  " -> trim, must succeed. DB row.name === "spaced".
    const paddedCreated = await call('POST', '/admin/anon-tags', admin.accessToken, {
      name: '  spaced  ',
      category: 'mood',
    });
    assert(paddedCreated.body.code === 0, `createAnonTag("  spaced  ") code=0 got=${JSON.stringify(paddedCreated.body)}`);
    const paddedId = paddedCreated.body.data?.id;
    if (paddedId) {
      const paddedRow = await prisma.anonTag.findUnique({ where: { id: paddedId }, select: { name: true } });
      assert(paddedRow?.name === 'spaced', `入库 name 已被 trim 为 "spaced" got=${JSON.stringify(paddedRow)}`);
    }

    // 1d: update with 13 chars -> must fail.
    const tooLongUpdated = await call('PUT', `/admin/anon-tags/${paddedId}`, admin.accessToken, {
      name: 'B'.repeat(13),
    });
    assert(
      tooLongUpdated.body.code !== 0,
      `updateAnonTag(13 chars) code !== 0 got code=${tooLongUpdated.body.code} msg=${JSON.stringify(tooLongUpdated.body.message)}`,
    );
    assert(
      tooLongUpdated.body.code === 30004 || msgContains(tooLongUpdated.body, '12 字符') || msgContains(tooLongUpdated.body, '长度'),
      `updateAnonTag(13 chars) 应触发服务层 30004 "标签名长度需在 1-12 字符之间" got code=${tooLongUpdated.body.code} msg=${JSON.stringify(tooLongUpdated.body.message)}`,
    );

    // 1e: update with valid name -> must succeed.
    const validUpdated = await call('PUT', `/admin/anon-tags/${paddedId}`, admin.accessToken, {
      name: 'ok',
    });
    assert(validUpdated.body.code === 0, `updateAnonTag("ok") code=0 got=${JSON.stringify(validUpdated.body)}`);
    const updatedRow = await prisma.anonTag.findUnique({ where: { id: paddedId }, select: { name: true } });
    assert(updatedRow?.name === 'ok', `update 后入库 name === "ok" got=${JSON.stringify(updatedRow)}`);

    // =============================================================
    // 2. Admin comment list filters by authorId (exact match).
    // =============================================================
    console.log('\n[2] 评论按作者筛选 (authorId)');
    // Need a post. Use any existing post or create one fresh.
    const circle = await prisma.circle.findFirst({ select: { id: true } });
    if (!circle) throw new Error('缺少 circle，无法造评论测试数据');
    const authorAId = user.user.id; // existing user from login.
    // Author B: we need a second user. Use the admin (separate account).
    const adminUser = await prisma.user.findUnique({ where: { id: admin.user.id }, select: { id: true } });
    if (!adminUser) throw new Error('admin 用户不存在');
    const authorBId = adminUser.id;
    if (authorAId === authorBId) throw new Error('逻辑矛盾：两个 authorId 相同');

    const commentKey = `Tail2Cm_${run}`;
    const authorAPost = await prisma.post.create({
      data: {
        circleId: circle.id,
        authorId: authorAId,
        content: `${commentKey}_POST`,
        images: [],
        status: 'APPROVED',
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });
    const cmA = await prisma.comment.create({
      data: { postId: authorAPost.id, authorId: authorAId, content: `${commentKey}_A` },
      select: { id: true },
    });
    const cmB = await prisma.comment.create({
      data: { postId: authorAPost.id, authorId: authorBId, content: `${commentKey}_B` },
      select: { id: true },
    });

    // 2a: filter by authorAId -> must only return A's comments (exclude B), and include cmA.
    const filterA = await call(
      'GET',
      `/admin/comments?page=1&pageSize=100&keyword=${encodeURIComponent(commentKey)}&authorId=${authorAId}`,
      admin.accessToken,
    );
    assert(filterA.body.code === 0, `authorId=A code=0 got=${JSON.stringify(filterA.body)}`);
    const listA = filterA.body.data?.list ?? [];
    assert(
      listA.length > 0 && listA.every((c) => c.id !== cmB.id),
      `authorId=A 返回不应包含 B 的评论 got ids=${listA.map((c) => c.id).join(',')} cmB=${cmB.id}`,
    );
    assert(
      listA.some((c) => c.id === cmA.id),
      `authorId=A 应至少返回 cmA got ids=${listA.map((c) => c.id).join(',')}`,
    );

    // 2b: filter by authorBId -> must only return B's comments (exclude A), and include cmB.
    const filterB = await call(
      'GET',
      `/admin/comments?page=1&pageSize=100&keyword=${encodeURIComponent(commentKey)}&authorId=${authorBId}`,
      admin.accessToken,
    );
    assert(filterB.body.code === 0, `authorId=B code=0 got=${JSON.stringify(filterB.body)}`);
    const listB = filterB.body.data?.list ?? [];
    assert(
      listB.length > 0 && listB.every((c) => c.id !== cmA.id),
      `authorId=B 返回不应包含 A 的评论 got ids=${listB.map((c) => c.id).join(',')} cmA=${cmA.id}`,
    );
    assert(
      listB.some((c) => c.id === cmB.id),
      `authorId=B 应至少返回 cmB got ids=${listB.map((c) => c.id).join(',')}`,
    );

    // 2c: no authorId -> must return both (mixed).
    const mixed = await call(
      'GET',
      `/admin/comments?page=1&pageSize=100&keyword=${encodeURIComponent(commentKey)}`,
      admin.accessToken,
    );
    assert(mixed.body.code === 0, `no authorId code=0 got=${JSON.stringify(mixed.body)}`);
    const mixedIds = new Set((mixed.body.data?.list ?? []).map((c) => c.id));
    assert(
      mixedIds.has(cmA.id) && mixedIds.has(cmB.id),
      `不带 authorId 应同时返回 cmA 与 cmB got ids=${[...mixedIds].join(',')}`,
    );

    console.log(`\n[admin-tail2 smoke] pass=${pass} fail=${fail}`);
    if (fail > 0) {
      throw new Error(`有 ${fail} 项断言失败`);
    }
    console.log('[admin-tail2 smoke] ALL PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error?.code === 'API_429' || error?.message === 'API_429') {
    console.error('配额超限无法继续');
  } else {
    console.error(`\n[admin-tail2 smoke] STOPPED: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
});
