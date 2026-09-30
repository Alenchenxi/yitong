/**
 * 管理端「广告位（Banner）+ 圈子（Community）」smoke
 * 覆盖：
 *   POST /admin/banners       创建
 *   GET  /admin/banners       列表
 *   POST /admin/banners/:id/toggle  启停
 *   PUT  /admin/banners/:id   编辑（排序/链接）
 *   DELETE /admin/banners/:id 删除
 *   GET  /admin/communities   圈子列表（含 cm_default）
 *   POST /admin/communities/:id/disable|enable  禁用/启用
 * 用法：BASE_URL / DATABASE_URL 可覆盖；前置 dev server（mock 模式）运行中。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j;
  try { j = await r.json(); } catch { j = { _raw: await r.text() }; }
  return { status: r.status, body: j };
}
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ FAIL: ') + msg); if (!cond) failed = 1; };

const created = { bannerIds: [], communityIds: [], userIds: [] };

// 登录限流 5/min（IP），429 时退避重试
async function login(code, role) {
  for (let i = 0; i < 6; i++) {
    const r = await call('POST', '/auth/wx-login', null, { code, role });
    if (r.body.code === 0) return r.body.data;
    if (r.status === 429) { await sleep(14000); continue; }
    throw new Error(`login ${role}/${code}: ${JSON.stringify(r.body).slice(0, 200)}`);
  }
  throw new Error(`login ${role}/${code}: 限流重试耗尽`);
}

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  console.log('[smoke-admin-banner-community] base =', BASE);
  try {
    const adm = await login('admin', 'admin');
    ok(true, 'admin 登录');
    const at = adm.accessToken;
    await sleep(500);

    // Banner CRUD
    const createdB = await call('POST', '/admin/banners', at, { title: 'smoke广告位', imageUrl: 'https://mock-minio.example.com/banners/smoke.png', linkUrl: null, sortOrder: 9, communityId: null });
    ok(createdB.body.code === 0, '创建 Banner');
    const bid = createdB.body.data?.id;
    created.bannerIds.push(bid);
    const list = await call('GET', '/admin/banners', at);
    ok(list.body.code === 0 && Array.isArray(list.body.data), 'Banner 列表');
    const toggle = await call('POST', `/admin/banners/${bid}/toggle`, at, { enabled: false });
    ok(toggle.body.code === 0 && toggle.body.data.status === 'DISABLED', 'Banner 停用');
    const upd = await call('PUT', `/admin/banners/${bid}`, at, { sortOrder: 5, linkUrl: 'https://example.com' });
    ok(upd.body.code === 0 && upd.body.data.sortOrder === 5, 'Banner 编辑 sortOrder=5');
    const del = await call('DELETE', `/admin/banners/${bid}`, at);
    ok(del.body.code === 0, 'Banner 删除');
    const list2 = await call('GET', '/admin/banners', at);
    ok(!(list2.body.data || []).some((b) => b.id === bid), 'Banner 已从列表移除');
    created.bannerIds = [];

    // 圈子 list + disable/enable
    const cmList = await call('GET', '/admin/communities', at);
    ok(cmList.body.code === 0 && Array.isArray(cmList.body.data), '圈子列表');
    ok((cmList.body.data || []).some((c) => c.id === 'cm_default'), 'cm_default 存在');

    const user = await login(`cmab_${Date.now().toString(36)}`, 'user');
    const ut = user.accessToken;
    created.userIds.push(user.user.id);
    const c = await call('POST', '/community', ut, { name: 'smoke圈子', category: '校园', region: '测试校区', location: '测试教学楼' });
    ok(c.body.code === 0, '普通用户建圈');
    const cid = c.body.data?.id;
    created.communityIds.push(cid);
    const dis = await call('POST', `/admin/communities/${cid}/disable`, at);
    ok(dis.body.code === 0 && dis.body.data.status === 'DISABLED', 'admin 禁用圈子');
    const en = await call('POST', `/admin/communities/${cid}/enable`, at);
    ok(en.body.code === 0 && en.body.data.status === 'ACTIVE', 'admin 启用圈子');

    console.log(failed ? '\n=== FAILED ===' : '\n=== ALL PASSED ===');
  } finally {
    // 清理
    if (created.communityIds.length) {
      await prisma.communityMember.deleteMany({ where: { communityId: { in: created.communityIds } } });
      await prisma.community.deleteMany({ where: { id: { in: created.communityIds } } });
    }
    if (created.bannerIds.length) await prisma.banner.deleteMany({ where: { id: { in: created.bannerIds } } });
    if (created.userIds.length) {
      for (const uid of created.userIds) {
        await prisma.userRole.deleteMany({ where: { userId: uid } });
        await prisma.user.delete({ where: { id: uid } }).catch(() => undefined);
      }
    }
    const leftover = await prisma.community.count({ where: { name: 'smoke圈子' } });
    console.log(`[cleanup] leftover smoke communities: ${leftover}`);
    await prisma.$disconnect();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
