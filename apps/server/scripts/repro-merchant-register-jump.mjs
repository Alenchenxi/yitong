/**
 * 复现脚本：商家入驻提交成功后能否进入商家端 shell
 *
 * 模拟用户端小程序真实链路：
 *  1) role-select 选「商家」→ POST /auth/wx-login {role:'merchant'}
 *  2) reLaunch /pages/merchant/index → GET /merchant/profile（入驻探测，未入驻 60002 → redirectTo register）
 *  3) register 页 onLoad → GET /merchant/profile（再探测一次）
 *  4) 提交 → POST /merchant/register → 看返回 status（决定前端走 APPROVED 分支还是 navigateBack 分支）
 *  5) APPROVED 分支 → POST /auth/switch-role {role:'merchant'}
 *  6) 模拟 prod：DB 把 status 改回 PENDING（并删 MERCHANT 角色/保留两种情况）→ 再试 switch-role + GET /merchant/profile
 *
 * 只读诊断 + 自建测试数据，结束清理。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const DB = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yitong';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 本机 .env 已配置真实微信凭证（mock code2session 关闭），wx-login 无法用假 code。
// 这里直接建 user + 签 JWT，等价于 wx-login role=merchant 的产物（ensureRole 用 upsert 补 UserRole）。
async function fakeLogin(prisma, jwtSecret, openid, nickname, role) {
  const { default: jwt } = await import('jsonwebtoken');
  const user = await prisma.user.create({ data: { openid, nickname, avatarUrl: null } });
  await prisma.userRole.create({ data: { userId: user.id, role } }); // 模拟 ensureRole upsert
  const payload = { uid: user.id, role, openid, type: 'access' };
  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '2h' });
  const roles = (await prisma.userRole.findMany({ where: { userId: user.id } })).map((r) => r.role);
  return { accessToken, role, user: { id: user.id, roles } };
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

(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const code = `repro-mch-${sfx}`;
  let uid = null;
  try {
    console.log('[1] wx-login role=merchant（等价：建 user + UserRole.MERCHANT + 签 JWT）');
    const fs = await import('node:fs');
    const envTxt = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const jwtSecret = envTxt.split(/\r?\n/).find((l) => l.startsWith('JWT_SECRET=')).slice('JWT_SECRET='.length).trim();
    const auth = await fakeLogin(prisma, jwtSecret, `mock_${code.slice(0, 8)}`, `repro${sfx}`, 'MERCHANT');
    uid = auth.user.id;
    console.log('    role =', auth.role, '| roles =', JSON.stringify(auth.user.roles));

    console.log('[2] shell 入驻探测 GET /merchant/profile');
    const probe = await call('GET', '/merchant/profile', auth.accessToken);
    console.log('    ->', probe.status, JSON.stringify(probe.body).slice(0, 160));

    console.log('[3] 提交入驻 POST /merchant/register');
    const reg = await call('POST', '/merchant/register', auth.accessToken, {
      shopName: `复现店${sfx}`, licenseNo: `L${sfx}`, contactPhone: '13800000000',
    });
    console.log('    ->', reg.status, JSON.stringify(reg.body).slice(0, 240));
    const status = reg.body?.data?.status;
    console.log('    前端分支 =', status === 'APPROVED' ? 'switchRole + reLaunch 商家 shell' : 'navigateBack（可能无上一页 -> 卡住）');

    console.log('[4] APPROVED 分支 POST /auth/switch-role');
    const sw = await call('POST', '/auth/switch-role', auth.accessToken, { role: 'merchant' });
    console.log('    ->', sw.status, JSON.stringify(sw.body).slice(0, 160));

    console.log('[5] 模拟 prod（NODE_ENV=production 不自动过审）：DB 置回 PENDING');
    await prisma.merchant.update({ where: { userId: uid }, data: { status: 'PENDING' } });
    const sw2 = await call('POST', '/auth/switch-role', auth.accessToken, { role: 'merchant' });
    console.log('    switch-role(PENDING) ->', sw2.status, JSON.stringify(sw2.body).slice(0, 160));
    const prof2 = await call('GET', '/merchant/profile', auth.accessToken);
    console.log('    GET /merchant/profile(PENDING) ->', prof2.status, JSON.stringify(prof2.body).slice(0, 200));
    const cand = await call('GET', '/merchant/candidates?page=1&pageSize=5', auth.accessToken);
    console.log('    GET /merchant/candidates(PENDING) ->', cand.status, JSON.stringify(cand.body).slice(0, 160));
    const noti = await call('GET', '/notifications?page=1&pageSize=5', auth.accessToken);
    console.log('    GET /notifications(PENDING) ->', noti.status, JSON.stringify(noti.body).slice(0, 120));

    console.log('[6] PENDING 用户重复提交 POST /merchant/register（驳回/待审重进入驻页场景）');
    const reg2 = await call('POST', '/merchant/register', auth.accessToken, {
      shopName: `复现店${sfx}`, licenseNo: `L${sfx}`, contactPhone: '13800000000',
    });
    console.log('    ->', reg2.status, JSON.stringify(reg2.body).slice(0, 160));
  } finally {
    if (uid) {
      await prisma.$transaction([
        prisma.merchant.deleteMany({ where: { userId: uid } }),
        prisma.userRole.deleteMany({ where: { userId: uid } }),
      ]).catch((e) => console.error('cleanup merchant/roles:', e.message));
      await prisma.moderationRecord.deleteMany({ where: { targetType: 'merchant', targetId: uid } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch((e) => console.error('cleanup user:', e.message));
      const left = await prisma.user.count({ where: { id: uid } });
      const leftM = await prisma.merchant.count({ where: { userId: uid } });
      console.log('[cleanup] user 残留 =', left, '| merchant 残留 =', leftM);
    }
    await prisma.$disconnect();
  }
})();
