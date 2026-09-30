/**
 * P1-12 smoke：下架/封禁/禁言通知
 * 跑法：node apps/server/scripts/smoke-p1-12-ban-notify.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const LOGIN_GAP_MS = parseInt(process.env.SMOKE_LOGIN_GAP_MS || '14000', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(LOGIN_GAP_MS); continue; }
    throw new Error(`login ${code}: ${JSON.stringify(j)}`);
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
async function waitNotif(token, predicate, timeoutMs = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await call('GET', `/notifications?unreadOnly=0&page=1&pageSize=50`, token);
    if (r.body.code === 0) {
      const hit = r.body.data.list.find(predicate);
      if (hit) return hit;
    }
    await sleep(150);
  }
  return null;
}
async function loginAdmin() {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'admin', role: 'admin' }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(LOGIN_GAP_MS); continue; }
    throw new Error(`admin login: ${JSON.stringify(j)}`);
  }
  throw new Error('admin login fail');
}
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[P1-12 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`bn-A-${sfx}-aaaa`, `BnA_${sfx}`);
  await sleep(LOGIN_GAP_MS);
  const B = await login(`bn-B-${sfx}-bbbb`, `BnB_${sfx}`);
  await sleep(LOGIN_GAP_MS);
  const adm = await loginAdmin();
  console.log('  A=', A.user.id, 'B=', B.user.id);

  const circle = (await call('GET', '/circles', A.accessToken)).body.data[0];

  // 用 B 发帖（admin 操作不踢自己）
  const post = await call('POST', `/circles/${circle.id}/posts`, B.accessToken, { content: '目标帖' });
  assert(post.body.code === 0, 'B 发帖');
  const pid = post.body.data.id;

  // 1) admin 下架帖子（带 reason）
  const td = await call('POST', `/admin/posts/${pid}/takedown`, adm.accessToken, { reason: '违规广告' });
  assert(td.body.code === 0, 'admin 下架');
  // 等待异步通知落库
  const tdNotif = await waitNotif(B.accessToken, (n) => n.type === 'post_takedown' && n.targetId === pid);
  assert(tdNotif, 'B 收到 post_takedown');
  assert(tdNotif.content.includes('违规广告'), '通知 content 含 reason');

  // 2) admin 禁言 A
  const mu = await call('POST', `/admin/users/${A.user.id}/mute`, adm.accessToken, { days: 7 });
  assert(mu.body.code === 0, 'admin 禁言 A 7 天');
  assert(mu.body.data.mutedUntil !== null, 'mutedUntil 非空');
  const muteNotif = await waitNotif(A.accessToken, (n) => n.type === 'user_muted');
  assert(muteNotif, 'A 收到 user_muted 通知');

  // 3) admin 解除禁言（days=0）
  const unmu = await call('POST', `/admin/users/${A.user.id}/mute`, adm.accessToken, { days: 0 });
  assert(unmu.body.code === 0, 'admin 解除禁言');
  assert(unmu.body.data.mutedUntil === null, 'mutedUntil=null');

  // 4) admin 封禁 A（deletedAt）
  const ban = await call('POST', `/admin/users/${A.user.id}/ban`, adm.accessToken);
  assert(ban.body.code === 0, 'admin 封禁 A');
  const banNotif = await waitNotif(A.accessToken, (n) => n.type === 'user_banned');
  assert(banNotif, 'A 收到 user_banned 通知');

  // 5) 封禁后 A 重新登录应被拒（wx-login 应 10005）
  const reLogin = await call('POST', `/auth/wx-login`, undefined, { code: `bn-A-${sfx}-aaaa`, role: 'user' });
  assert(reLogin.body.code === 10005, `封禁后登录 10005 got ${reLogin.body.code}`);

  console.log('\n[P1-12 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-12 smoke] STOPPED:', e.message);
  process.exit(1);
});
