/**
 * P1-10 smoke：帖子编辑/删除（author only + soft delete）
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
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); process.exitCode = 1; throw new Error(msg); }
  console.log('  ✓', msg);
}

(async () => {
  console.log('[P1-10 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`ed-A-${sfx}-aaaa`, `EdA_${sfx}`);
  await sleep(LOGIN_GAP_MS);
  const B = await login(`ed-B-${sfx}-bbbb`, `EdB_${sfx}`);
  const circle = (await call('GET', '/circles', A.accessToken)).body.data[0];

  // A 发帖
  const post = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, {
    content: '原文 1', tags: ['校园'],
  });
  assert(post.body.code === 0, 'A 发帖');
  const pid = post.body.data.id;
  assert(post.body.data.editedAt === null, 'editedAt=null 初始');

  // 1) 编辑：A 修改自己的帖子
  const edited = await call('PUT', `/posts/${pid}`, A.accessToken, {
    content: '已编辑 2', tags: ['校园', '食堂'],
  });
  assert(edited.body.code === 0, 'A edit own post');
  assert(edited.body.data.content === '已编辑 2', 'content 已改');
  assert(edited.body.data.tags.length === 2, 'tags 已改');
  assert(edited.body.data.editedAt !== null, 'editedAt 已写');

  // 编辑后 getPost 应能查到
  const g1 = await call('GET', `/posts/${pid}`, A.accessToken);
  assert(g1.body.data.content === '已编辑 2', 'getPost 看到新内容');

  // 2) B（他人）编辑 A 的帖子 → 403/10003
  const bad = await call('PUT', `/posts/${pid}`, B.accessToken, {
    content: 'B 想改', tags: [],
  });
  assert(bad.body.code === 10003, `他人 edit 拒绝 got ${bad.body.code}`);

  // 3) 编辑不存在的帖子 → 20003
  const en = await call('PUT', `/posts/noexist000`, A.accessToken, {
    content: 'x', tags: [],
  });
  assert(en.body.code === 20003, `编辑不存在帖 20003 got ${en.body.code}`);

  // 4) B 删除 A 的帖子 → 403/10003
  const delBad = await call('DELETE', `/posts/${pid}`, B.accessToken);
  assert(delBad.body.code === 10003, `他人 delete 拒绝 got ${delBad.body.code}`);

  // 5) A 删除自己的帖子（软删）
  const del = await call('DELETE', `/posts/${pid}`, A.accessToken);
  assert(del.body.code === 0 && del.body.data.deleted === true, 'A delete own');
  // getPost 应找不到（deletedAt 过滤）
  const g2 = await call('GET', `/posts/${pid}`, A.accessToken);
  assert(g2.body.code === 20003, '软删后 getPost 20003');
  // 列表也不应出现
  const list = await call('GET', `/posts/feed?limit=50`, A.accessToken);
  assert(!list.body.data.list.some((p) => p.id === pid), '软删后 feed 不可见');
  // 我的发布仍可见
  const mine = await call('GET', `/posts/mine`, A.accessToken);
  assert(mine.body.data.list.some((p) => p.id === pid), '我的发布仍可见软删帖');

  // 6) 删除不存在的帖子 → 20003
  const den = await call('DELETE', `/posts/noexist000`, A.accessToken);
  assert(den.body.code === 20003, `删除不存在 20003 got ${den.body.code}`);

  console.log('\n[P1-10 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-10 smoke] STOPPED:', e.message);
  process.exit(1);
});
