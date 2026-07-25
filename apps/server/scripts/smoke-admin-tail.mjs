/**
 * Admin tail smoke (feat/admin-tail-cleanup).
 *
 * Covers:
 *   A static maxlength is checked separately (two WXML inputs).
 *   E anon-tag DELETE is a soft delete (row remains, active=false).
 *   D CLOSED ticket can reopen; non-CLOSED tickets return 40004.
 *   C admin post pagination supports the PENDING/APPROVED/REJECTED filter.
 *   B admin comment pagination supports a case-insensitive keyword filter.
 *
 * Prerequisites: PostgreSQL/Redis are running and the Nest server is already
 * listening (for example, `npx nest start` from apps/server).
 *
 * Usage from the repository root:
 *   node apps/server/scripts/smoke-admin-tail.mjs
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
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

async function main() {
  console.log(`[admin-tail smoke] base = ${BASE}`);
  const run = suffix();
  const user = await login(`tailU_${run}`, `TailUser_${run}`, 'user');
  const admin = await login('admin', '管理员', 'admin');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

  try {
    // =============================================================
    // E: anon-tag DELETE must retain the row and set active=false.
    // =============================================================
    console.log('\n[E] 匿名标签软删');
    const tagName = `t${run.slice(-10)}`; // 11 chars at most, within schema maxlength=12.
    const createdTag = await call('POST', '/admin/anon-tags', admin.accessToken, {
      name: tagName,
      category: 'mood',
      sortOrder: 17,
    });
    assert(createdTag.body.code === 0, `创建标签 code=0 got=${JSON.stringify(createdTag.body)}`);
    const tagId = createdTag.body.data.id;

    const deletedTag = await call('DELETE', `/admin/anon-tags/${tagId}`, admin.accessToken);
    assert(deletedTag.body.code === 0, `删除标签接口 code=0 got=${JSON.stringify(deletedTag.body)}`);
    const tagRow = await prisma.anonTag.findUnique({ where: { id: tagId } });
    assert(!!tagRow, `软删后标签行仍存在 id=${tagId}`);
    assert(tagRow.active === false, `软删后 active=false got=${tagRow.active}`);

    // =============================================================
    // D: CLOSED -> IN_PROGRESS and reply fields are cleared.  OPEN
    // is the persisted equivalent of the old PENDING wording.
    // =============================================================
    console.log('\n[D] CLOSED 工单重开');
    const ticket = await call('POST', '/support/tickets', user.accessToken, {
      title: `重开工单_${run}`,
      content: 'admin-tail smoke ticket',
    });
    assert(ticket.body.code === 0, `用户建工单 code=0 got=${JSON.stringify(ticket.body)}`);
    const ticketId = ticket.body.data.id;

    const closed = await call('POST', `/admin/tickets/${ticketId}/reply`, admin.accessToken, {
      reply: '先关闭再重开',
      close: true,
    });
    assert(closed.body.code === 0, `reply close=true code=0 got=${JSON.stringify(closed.body)}`);
    assert(closed.body.data.status === 'CLOSED', `reply close=true -> CLOSED got=${closed.body.data.status}`);

    const reopened = await call('POST', `/admin/tickets/${ticketId}/reopen`, admin.accessToken);
    assert(reopened.body.code === 0, `reopen CLOSED code=0 got=${JSON.stringify(reopened.body)}`);
    assert(reopened.body.data.status === 'IN_PROGRESS', `reopen -> IN_PROGRESS got=${reopened.body.data.status}`);
    const reopenedRow = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { status: true, reply: true, repliedBy: true, repliedAt: true },
    });
    assert(!!reopenedRow, `重开后工单仍存在 id=${ticketId}`);
    assert(reopenedRow.status === 'IN_PROGRESS', `DB status=IN_PROGRESS got=${reopenedRow.status}`);
    assert(reopenedRow.reply === null, `DB reply=null got=${reopenedRow.reply}`);
    assert(reopenedRow.repliedBy === null, `DB repliedBy=null got=${reopenedRow.repliedBy}`);
    assert(reopenedRow.repliedAt === null, `DB repliedAt=null got=${reopenedRow.repliedAt}`);

    // OPEN (PENDING-equivalent) cannot reopen.
    const openTicket = await call('POST', '/support/tickets', user.accessToken, {
      title: `未处理工单_${run}`,
      content: 'open ticket must not reopen',
    });
    assert(openTicket.body.code === 0, '创建 OPEN 工单');
    const openReopen = await call('POST', `/admin/tickets/${openTicket.body.data.id}/reopen`, admin.accessToken);
    assert(openReopen.body.code === 40004, `OPEN/PENDING 工单重开返回 40004 got=${openReopen.body.code}`);

    // IN_PROGRESS cannot reopen either.
    const progressTicket = await call('POST', '/support/tickets', user.accessToken, {
      title: `处理中工单_${run}`,
      content: 'in-progress ticket must not reopen',
    });
    assert(progressTicket.body.code === 0, '创建 IN_PROGRESS 测试工单');
    const progressId = progressTicket.body.data.id;
    const kept = await call('POST', `/admin/tickets/${progressId}/reply`, admin.accessToken, {
      reply: '保留处理中',
      close: false,
    });
    assert(kept.body.code === 0 && kept.body.data.status === 'IN_PROGRESS', '工单置为 IN_PROGRESS');
    const progressReopen = await call('POST', `/admin/tickets/${progressId}/reopen`, admin.accessToken);
    assert(progressReopen.body.code === 40004, `IN_PROGRESS 工单重开返回 40004 got=${progressReopen.body.code}`);

    // =============================================================
    // C: create three statuses directly, then exercise filtered and
    // unfiltered admin pagination with a unique keyword.
    // =============================================================
    console.log('\n[C] 帖子 status 筛选');
    const circle = await prisma.circle.findFirst({ select: { id: true } });
    assert(!!circle, '数据库存在表白墙圈子');
    const postKey = `TailPost_${run}`;
    const postRows = [];
    for (const status of ['PENDING', 'APPROVED', 'REJECTED']) {
      const post = await prisma.post.create({
        data: {
          circleId: circle.id,
          authorId: user.user.id,
          content: `${postKey}_${status}`,
          images: [],
          status,
          visibility: 'PUBLIC',
        },
        select: { id: true, status: true },
      });
      postRows.push(post);
    }
    const approved = await call(
      'GET',
      `/admin/posts?page=1&pageSize=100&keyword=${encodeURIComponent(postKey)}&status=APPROVED`,
      admin.accessToken,
    );
    assert(approved.body.code === 0, `status=APPROVED code=0 got=${JSON.stringify(approved.body)}`);
    assert(approved.body.data.list.length > 0, 'status=APPROVED 至少返回一条目标帖');
    assert(approved.body.data.list.every((post) => post.status === 'APPROVED'), 'status=APPROVED 返回项全部为 APPROVED');
    assert(approved.body.data.list.some((post) => post.id === postRows[1].id), 'status=APPROVED 命中目标帖');

    const rejected = await call(
      'GET',
      `/admin/posts?page=1&pageSize=100&keyword=${encodeURIComponent(postKey)}&status=REJECTED`,
      admin.accessToken,
    );
    assert(rejected.body.code === 0, `status=REJECTED code=0 got=${JSON.stringify(rejected.body)}`);
    assert(rejected.body.data.list.length > 0, 'status=REJECTED 至少返回一条目标帖');
    assert(rejected.body.data.list.every((post) => post.status === 'REJECTED'), 'status=REJECTED 返回项全部为 REJECTED');
    assert(rejected.body.data.list.some((post) => post.id === postRows[2].id), 'status=REJECTED 命中目标帖');

    const allStatuses = await call(
      'GET',
      `/admin/posts?page=1&pageSize=100&keyword=${encodeURIComponent(postKey)}`,
      admin.accessToken,
    );
    assert(allStatuses.body.code === 0, `不带 status code=0 got=${JSON.stringify(allStatuses.body)}`);
    const statusSet = new Set(allStatuses.body.data.list.map((post) => post.status));
    assert(statusSet.has('PENDING') && statusSet.has('APPROVED') && statusSet.has('REJECTED'), `不带 status 返回混合状态 got=${[...statusSet].join(',')}`);

    // =============================================================
    // B: keyword filter is case-insensitive and excludes unrelated text.
    // =============================================================
    console.log('\n[B] 评论 keyword 筛选');
    const commentKey = `TailComment_${run}`;
    const targetPostId = postRows[1].id;
    const matchingComment = await prisma.comment.create({
      data: {
        postId: targetPostId,
        authorId: user.user.id,
        content: `prefix ${commentKey} suffix`,
      },
      select: { id: true },
    });
    const mixedCaseComment = await prisma.comment.create({
      data: {
        postId: targetPostId,
        authorId: user.user.id,
        content: `mixed ${commentKey.toUpperCase()} value`,
      },
      select: { id: true },
    });
    await prisma.comment.create({
      data: {
        postId: targetPostId,
        authorId: user.user.id,
        content: `unrelated_${run}`,
      },
      select: { id: true },
    });
    const comments = await call(
      'GET',
      `/admin/comments?page=1&pageSize=100&keyword=${encodeURIComponent(commentKey)}`,
      admin.accessToken,
    );
    assert(comments.body.code === 0, `评论 keyword code=0 got=${JSON.stringify(comments.body)}`);
    assert(comments.body.data.list.length >= 2, `keyword 至少命中两条评论 got=${comments.body.data.list.length}`);
    const lowerKey = commentKey.toLowerCase();
    assert(comments.body.data.list.every((comment) => comment.content.toLowerCase().includes(lowerKey)), 'keyword 返回每条评论都包含关键词（大小写不敏感）');
    const ids = new Set(comments.body.data.list.map((comment) => comment.id));
    assert(ids.has(matchingComment.id) && ids.has(mixedCaseComment.id), 'keyword 命中两条目标评论');

    console.log('\n[admin-tail smoke] ALL PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error?.code === 'API_429' || error?.message === 'API_429') {
    console.error('配额超限无法继续');
  } else {
    console.error(`\n[admin-tail smoke] STOPPED: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
});
