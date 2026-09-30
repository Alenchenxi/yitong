/**
 * M4-01 通知分类 smoke
 * 覆盖：
 *   GET /api/v1/notifications?category=apply|system|order （分页 + 类型映射过滤）
 *   GET /api/v1/notifications/unread-counts （各分类未读数）
 *   unreadOnly=1 / 非法 category 忽略 / order 返回空集
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3000 + docker postgres。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(14000); continue; }
    throw new Error(`login: ${JSON.stringify(j)}`);
  }
  throw new Error('login fail');
}
async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await r.json(); } catch { json = null; }
  return { status: r.status, body: json };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a !== e) { console.error('  ✗ FAIL:', msg, 'expected=', e, 'actual=', a); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

// 类型 -> 期望分类映射（与 notification.service.ts CATEGORY_TYPE_MAP 对齐）
const APPLY_TYPES = ['job_apply', 'job_accept', 'job_complete', 'job_reject', 'job_review_from_merchant'];
const SYSTEM_TYPES = [
  'post_like', 'post_comment', 'comment_reply', 'post_follow', 'comment_like',
  'comment_mention', 'post_takedown', 'user_banned', 'user_muted', 'report_result', 'ticket_reply',
];
const ALL_TEST_TYPES = [...APPLY_TYPES, ...SYSTEM_TYPES];

const created = { userIds: [], notificationIds: [] };
let prismaRef = null;

async function cleanup(prisma) {
  console.log('\n[cleanup] 开始清理测试数据...');
  const uids = created.userIds;
  // FK 顺序：Notification -> UserRole -> User
  let r = await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  notifications deleteMany: ${r.count}`);
  r = await prisma.userRole.deleteMany({ where: { userId: { in: uids } } });
  console.log(`  user_roles deleteMany: ${r.count}`);
  r = await prisma.user.deleteMany({ where: { id: { in: uids } } });
  console.log(`  users deleteMany: ${r.count}`);
  // 自验证
  const remainNotifs = await prisma.notification.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  const remainUsers = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true } });
  assert(remainNotifs.length === 0, `自验证: notifications 无残留 (剩 ${remainNotifs.length})`);
  assert(remainUsers.length === 0, `自验证: users 无残留 (剩 ${remainUsers.length})`);
  console.log('[cleanup] 清理完成并自验证通过');
}

(async () => {
  console.log('[m4-01 notification-category smoke] base =', BASE);
  const sfx = `m4n${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  prismaRef = prisma;

  try {
    // 1) 登录 1 个用户（通知按 userId 过滤，user 角色即可）
    const U = await login(`UN${sfx}`, `NotifUser_${sfx}`, 'user');
    created.userIds.push(U.user.id);
    const uid = U.user.id;

    // 2) 直接通过 Prisma 插入不同 type 的通知（交替 read/unread，偶数索引 unread）
    const rows = ALL_TEST_TYPES.map((type, i) => ({
      userId: uid,
      type,
      title: `测试通知_${type}`,
      content: `m4-01 smoke ${type}`,
      targetType: 'job_post',
      targetId: `fake_${sfx}`,
      extraId: null,
      read: i % 2 === 1, // 偶数索引 unread，奇数索引 read
    }));
    const inserted = await prisma.notification.createMany({ data: rows });
    console.log(`  插入通知 ${inserted.count} 条（apply=${APPLY_TYPES.length}, system=${SYSTEM_TYPES.length}）`);
    const notifs = await prisma.notification.findMany({
      where: { userId: uid, targetId: `fake_${sfx}` },
      select: { id: true, type: true, read: true },
    });
    created.notificationIds.push(...notifs.map((n) => n.id));

    // 期望未读数（从实际插入记录计算，避免全局/局部索引奇偶偏移导致期望算错）
    const expectApplyUnread = notifs.filter((n) => APPLY_TYPES.includes(n.type) && !n.read).length;
    const expectSystemUnread = notifs.filter((n) => SYSTEM_TYPES.includes(n.type) && !n.read).length;
    console.log(`  期望未读 apply=${expectApplyUnread} system=${expectSystemUnread} order=0`);

    // 3) 验证点 1：category=apply 只返回 apply 类型
    const rApply = await call('GET', '/notifications?category=apply', U.accessToken);
    assert(rApply.body.code === 0, 'category=apply code=0');
    const applyList = rApply.body.data.list;
    const applyTypes = applyList.map((n) => n.type);
    assert(applyList.length === APPLY_TYPES.length, `category=apply 返回 ${APPLY_TYPES.length} 条 got=${applyList.length}`);
    assert(applyTypes.every((t) => APPLY_TYPES.includes(t)), 'category=apply 全部为 apply 类型');
    assert(!applyTypes.some((t) => SYSTEM_TYPES.includes(t)), 'category=apply 不含 system 类型');

    // 4) 验证点 1b：category=system 只返回 system 类型
    const rSystem = await call('GET', '/notifications?category=system', U.accessToken);
    assert(rSystem.body.code === 0, 'category=system code=0');
    const systemList = rSystem.body.data.list;
    const systemTypes = systemList.map((n) => n.type);
    assert(systemList.length === SYSTEM_TYPES.length, `category=system 返回 ${SYSTEM_TYPES.length} 条 got=${systemList.length}`);
    assert(systemTypes.every((t) => SYSTEM_TYPES.includes(t)), 'category=system 全部为 system 类型');

    // 5) 验证点 4：category=order 返回空列表
    const rOrder = await call('GET', '/notifications?category=order', U.accessToken);
    assert(rOrder.body.code === 0, 'category=order code=0');
    assertEq(rOrder.body.data.list.length, 0, 'category=order 返回空列表');
    assertEq(rOrder.body.data.total, 0, 'category=order total=0');

    // 6) 验证点 3：非法 category=foo 等价于不带 category（返回全部）
    const rFoo = await call('GET', '/notifications?category=foo', U.accessToken);
    assert(rFoo.body.code === 0, 'category=foo code=0');
    const rAll = await call('GET', '/notifications', U.accessToken);
    assert(rAll.body.code === 0, '无 category code=0');
    assertEq(rFoo.body.data.total, rAll.body.data.total, '非法 category=foo total == 无 category total');
    assertEq(rFoo.body.data.total, ALL_TEST_TYPES.length, `全部通知 total=${ALL_TEST_TYPES.length} got=${rFoo.body.data.total}`);

    // 7) 验证点 2：unread-counts 各分类计数与实际未读数一致
    const rCounts = await call('GET', '/notifications/unread-counts', U.accessToken);
    assert(rCounts.body.code === 0, 'unread-counts code=0');
    const counts = rCounts.body.data;
    assertEq(counts.apply, expectApplyUnread, `unread-counts.apply=${expectApplyUnread}`);
    assertEq(counts.system, expectSystemUnread, `unread-counts.system=${expectSystemUnread}`);
    assertEq(counts.order, 0, 'unread-counts.order=0');

    // 8) 验证点 5：unreadOnly=1 只返回未读
    const rUnread = await call('GET', '/notifications?unreadOnly=1', U.accessToken);
    assert(rUnread.body.code === 0, 'unreadOnly=1 code=0');
    const unreadList = rUnread.body.data.list;
    assert(unreadList.every((n) => n.read === false), 'unreadOnly=1 全部 read=false');
    assertEq(rUnread.body.data.total, expectApplyUnread + expectSystemUnread, `unreadOnly=1 total=${expectApplyUnread + expectSystemUnread}`);

    // 9) 组合：category=apply&unreadOnly=1 -> 仅未读 apply
    const rApplyUnread = await call('GET', '/notifications?category=apply&unreadOnly=1', U.accessToken);
    assert(rApplyUnread.body.code === 0, 'category=apply&unreadOnly=1 code=0');
    const auList = rApplyUnread.body.data.list;
    assert(auList.every((n) => APPLY_TYPES.includes(n.type) && n.read === false), 'apply&unreadOnly 全是未读 apply');
    assertEq(auList.length, expectApplyUnread, `apply&unreadOnly 数量=${expectApplyUnread}`);

    // 10) 未带 token -> 401
    const rNoToken = await call('GET', '/notifications', null);
    assert(rNoToken.status === 401, `未带 token HTTP 401 got=${rNoToken.status}`);

    console.log('\n[m4-01 notification-category smoke] ALL PASSED');
  } finally {
    await cleanup(prisma);
    await prisma.$disconnect();
  }
})().catch(async (e) => {
  console.error('\n[m4-01 notification-category smoke] STOPPED:', e.message);
  if (prismaRef) {
    try { await cleanup(prismaRef); } catch (ce) { console.error('[cleanup] 清理异常:', ce.message); }
    try { await prismaRef.$disconnect(); } catch {}
  }
  process.exit(1);
});
