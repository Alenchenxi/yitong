/**
 * P1-09 smoke：关注/粉丝列表（极限简版：2 用户，最少请求避免限流）
 * 跑前建议关闭/避免前 60s 内的相关请求，或重启 server 清空 throttle 计数器。
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const LOGIN_GAP_MS = parseInt(process.env.SMOKE_LOGIN_GAP_MS || '14000', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) {
      console.log(`  ⏸ 登录限流，等待 ${LOGIN_GAP_MS}ms...`);
      await sleep(LOGIN_GAP_MS);
      continue;
    }
    throw new Error(`login failed: ${JSON.stringify(j)}`);
  }
  throw new Error('login failed after retries');
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
  console.log('[P1-09 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`fl-A-${sfx}-aaaa`, `FlA_${sfx}`);
  await sleep(LOGIN_GAP_MS);
  const B = await login(`fl-B-${sfx}-bbbb`, `FlB_${sfx}`);
  console.log('  A=', A.user.id, 'B=', B.user.id);

  let r;
  // 自关注 → 70004
  r = await call('POST', `/users/${A.user.id}/follow`, A.accessToken);
  assert(r.body.code === 70004, 'self follow -> 70004');
  // A 关注 B
  r = await call('POST', `/users/${B.user.id}/follow`, A.accessToken);
  assert(r.body.data.following === true, 'A follow B');
  // B 不应 follow 自己已关注
  r = await call('POST', `/users/${B.user.id}/follow`, B.accessToken);
  assert(r.body.code === 70004, 'B self follow -> 70004');
  // 我（B）的关注列表 — 应为空
  let folB = await call('GET', `/users/me/following?page=1&pageSize=30`, B.accessToken);
  assert(folB.body.code === 0, 'B me/following');
  assert(folB.body.data.list.length === 0, `B following empty got ${folB.body.data.list.length}`);
  // 我（A）的关注列表 — 应包含 B
  let folA = await call('GET', `/users/me/following?page=1&pageSize=30`, A.accessToken);
  assert(folA.body.code === 0, 'A me/following');
  assert(folA.body.data.list.some((x) => x.userId === B.user.id), 'A following 包含 B');
  assert(folA.body.data.list.every((x) => typeof x.followedAt === 'string'), 'followedAt 字段');
  // 我（B）的粉丝列表 — 应包含 A
  let fansB = await call('GET', `/users/me/followers?page=1&pageSize=30`, B.accessToken);
  assert(fansB.body.code === 0, 'B me/followers');
  assert(fansB.body.data.list.some((x) => x.userId === A.user.id), 'B followers 包含 A');
  // 我的关注态 + A 取关 B
  r = await call('POST', `/users/${B.user.id}/follow`, A.accessToken);
  assert(r.body.data.following === false, 'A unfollow B');
  // A following 不再有 B
  folA = await call('GET', `/users/me/following?page=1&pageSize=30`, A.accessToken);
  assert(!folA.body.data.list.some((x) => x.userId === B.user.id), 'A following 已无 B');

  console.log('\n[P1-09 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-09 smoke] STOPPED:', e.message);
  process.exit(1);
});
