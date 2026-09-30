/**
 * 商家驳回后重新提交资质 smoke
 *
 * 覆盖：
 *  1) 注册 → dev 自动过审 → DB 直接改 REJECTED + 删 MERCHANT 角色
 *  2) POST /merchant/reapply 成功，status 回 PENDING，三字段已更新
 *  3) merchant 行复查：licenseNo/shopName/contactPhone 已更新，createdAt 未重置
 *  4) ModerationRecord 写入：reason='商家重新提交审核' / status='PENDING' / reviewerId=null
 *  5) user_role.MERCHANT 未恢复（角色仅 admin 审批通过时授予）
 *  6) GET /merchant/profile 返回 lastRejectReason
 *  7) 错误码守卫：APPROVED → 60005；PENDING → 60005；未入驻用户 → 60002
 *
 * 用法：BASE_URL / DATABASE_URL 可覆盖；默认 localhost:3000 + docker postgres
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
  return { status: r.status, body: await r.json() };
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[merchant-reapply smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`RA${sfx}`, `Reapply_A_${sfx}`);
  await sleep(14000);
  const C = await login(`RC${sfx}`, `NoMerchant_${sfx}`); // 未注册账号，用于 60002 守卫
  // wx-login 返回 {accessToken, refreshToken, user, role}，user.id 才是 Prisma 用的 uid
  const Auid = A.user.id;
  const Cuid = C.user.id;

  // ===== 1) 注册 + dev 自动过审，DB 改 REJECTED + 删 MERCHANT 角色 =====
  const reg = await call('POST', '/merchant/register', A.accessToken, {
    shopName: `原店_${sfx}`,
    licenseNo: `LIC_ORIG_${sfx}`,
    contactPhone: '13800000009',
  });
  assert(reg.body.code === 0, `注册成功 code=0 got ${reg.body.code}`);
  const merchantId = reg.body.data.id;
  assert(reg.body.data.status === 'APPROVED', `dev 自动过审 status=APPROVED got ${reg.body.data.status}`);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });

  await prisma.userRole.deleteMany({ where: { userId: Auid, role: 'MERCHANT' } });
  await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'REJECTED' },
  });
  // 模拟 admin 驳回时写一条 REJECTED ModerationRecord，使 getProfile.lastRejectReason 有值
  await prisma.moderationRecord.create({
    data: { targetType: 'merchant', targetId: merchantId, reason: '营业执照不清晰', status: 'REJECTED', reviewerId: null },
  });

  const afterReject = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { status: true, createdAt: true } });
  const origCreatedAt = afterReject.createdAt;
  assert(afterReject.status === 'REJECTED', `DB merchant.status=REJECTED got ${afterReject.status}`);
  const roleStill = await prisma.userRole.findUnique({ where: { userId_role: { userId: Auid, role: 'MERCHANT' } } });
  assert(roleStill === null, `MERCHANT 角色已删 got ${JSON.stringify(roleStill)}`);

  // ===== 6) GET /merchant/profile 应返回 lastRejectReason =====
  const prof = await call('GET', '/merchant/profile', A.accessToken);
  assert(prof.body.code === 0, `GET /merchant/profile code=0 got ${prof.body.code}`);
  assert(prof.body.data.status === 'REJECTED', `profile.status=REJECTED got ${prof.body.data.status}`);
  assert(prof.body.data.lastRejectReason === '营业执照不清晰', `profile.lastRejectReason='营业执照不清晰' got ${prof.body.data.lastRejectReason}`);

  // ===== 2) POST /merchant/reapply 成功 =====
  const reapply = await call('POST', '/merchant/reapply', A.accessToken, {
    shopName: `重提交店_${sfx}`,
    licenseNo: `LIC_NEW_${sfx}`,
    contactPhone: '13800000010',
  });
  assert(reapply.body.code === 0, `reapply code=0 got ${reapply.body.code} msg=${reapply.body.message}`);
  assert(reapply.body.data.status === 'PENDING', `reapply 后 status=PENDING got ${reapply.body.data.status}`);
  assert(reapply.body.data.shopName === `重提交店_${sfx}`, `shopName 已更新 got ${reapply.body.data.shopName}`);
  assert(reapply.body.data.licenseNo === `LIC_NEW_${sfx}`, `licenseNo 已更新 got ${reapply.body.data.licenseNo}`);
  assert(reapply.body.data.contactPhone === '13800000010', `contactPhone 已更新 got ${reapply.body.data.contactPhone}`);

  // ===== 3) DB merchant 复查：字段已更新，createdAt 未变 =====
  const afterReapply = await prisma.merchant.findUnique({ where: { id: merchantId } });
  assert(afterReapply.status === 'PENDING', `DB merchant.status=PENDING got ${afterReapply.status}`);
  assert(afterReapply.licenseNo === `LIC_NEW_${sfx}`, `DB licenseNo 已更新 got ${afterReapply.licenseNo}`);
  assert(afterReapply.shopName === `重提交店_${sfx}`, `DB shopName 已更新 got ${afterReapply.shopName}`);
  assert(afterReapply.createdAt.getTime() === origCreatedAt.getTime(), `createdAt 未重置 orig=${origCreatedAt.toISOString()} now=${afterReapply.createdAt.toISOString()}`);

  // ===== 4) ModerationRecord 写入审查 =====
  const mod = await prisma.moderationRecord.findFirst({
    where: { targetType: 'merchant', targetId: merchantId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  assert(mod !== null, 'ModerationRecord (status=PENDING) 已写入');
  assert(mod.reason === '商家重新提交审核', `ModerationRecord.reason='商家重新提交审核' got ${mod.reason}`);
  assert(mod.reviewerId === null, `ModerationRecord.reviewerId=null got ${mod.reviewerId}`);
  assert(mod.targetId === merchantId, `ModerationRecord.targetId=merchantId got ${mod.targetId}`);

  // ===== 5) MERCHANT 角色未恢复（预期） =====
  const roleAfter = await prisma.userRole.findUnique({ where: { userId_role: { userId: Auid, role: 'MERCHANT' } } });
  assert(roleAfter === null, `reapply 后 MERCHANT 角色仍未恢复（预期） got ${JSON.stringify(roleAfter)}`);

  // ===== 7) 错误码守卫 =====
  // 7a. APPROVED → 60005
  await prisma.merchant.update({ where: { id: merchantId }, data: { status: 'APPROVED' } });
  const guardAppr = await call('POST', '/merchant/reapply', A.accessToken, {
    shopName: 'g1', licenseNo: 'LIC_G1', contactPhone: '13800000011',
  });
  assert(guardAppr.body.code === 60005, `APPROVED 守卫 60005 got ${guardAppr.body.code} msg=${guardAppr.body.message}`);

  // 7b. PENDING → 60005
  await prisma.merchant.update({ where: { id: merchantId }, data: { status: 'PENDING' } });
  const guardPending = await call('POST', '/merchant/reapply', A.accessToken, {
    shopName: 'g2', licenseNo: 'LIC_G2', contactPhone: '13800000012',
  });
  assert(guardPending.body.code === 60005, `PENDING 守卫 60005 got ${guardPending.body.code} msg=${guardPending.body.message}`);

  // 7c. 未入驻用户 → 60002
  const guardNoReg = await call('POST', '/merchant/reapply', C.accessToken, {
    shopName: 'g3', licenseNo: 'LIC_G3', contactPhone: '13800000013',
  });
  assert(guardNoReg.body.code === 60002, `未入驻守卫 60002 got ${guardNoReg.body.code} msg=${guardNoReg.body.message}`);

  await prisma.$disconnect();
  console.log('\n[merchant-reapply smoke] ALL PASSED');
})().catch(async (e) => {
  console.error('\n[merchant-reapply smoke] STOPPED:', e.message);
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
