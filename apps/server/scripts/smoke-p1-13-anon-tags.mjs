/**
 * P1-13 smoke：树洞标签体系（标签库 / profile 校验 / 发帖 mood 校验 / admin CRUD）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const LOGIN_GAP_MS = parseInt(process.env.SMOKE_LOGIN_GAP_MS || '14000', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
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
  console.log('[P1-13 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`tg-A-${sfx}-aaaa`, `TgA_${sfx}`);
  await sleep(LOGIN_GAP_MS);
  const adm = await login('admin', undefined, 'admin');

  // 1) 公开标签库 GET /treehole/tags
  const tags = await call('GET', `/treehole/tags`);
  assert(tags.body.code === 0, 'GET /treehole/tags');
  const lib = tags.body.data;
  assert(Array.isArray(lib.personality) && Array.isArray(lib.interest) && Array.isArray(lib.mood), '三类分组');
  assert(lib.mood.some((t) => t.name === '开心'), 'mood 含「开心」（seed）');
  assert(lib.interest.some((t) => t.name === '音乐'), 'interest 含「音乐」');

  // 2) profile 选合法标签 -> OK
  const upd1 = await call('PUT', `/treehole/profile`, A.accessToken, {
    personalityTags: ['社恐', '慢热'],
    interestTags: ['音乐', '电影'],
    moodState: '开心',
  });
  assert(upd1.body.code === 0, 'profile 选合法标签');
  assert(upd1.body.data.personalityTags.includes('社恐'), 'personalityTags 已存');
  assert(upd1.body.data.moodState === '开心', 'moodState 已存');

  // 3) profile 选非法标签 -> 30003
  const upd2 = await call('PUT', `/treehole/profile`, A.accessToken, {
    interestTags: ['不存在的标签xyz'],
  });
  assert(upd2.body.code === 30003, `非法标签 30003 got ${upd2.body.code}`);

  // 4) profile mood 非法 -> 30003
  const upd3 = await call('PUT', `/treehole/profile`, A.accessToken, {
    moodState: '乱七八糟mood',
  });
  assert(upd3.body.code === 30003, `非法 mood 30003 got ${upd3.body.code}`);

  // 5) 换 anonToken + 发帖 mood 合法
  const at = await call('POST', `/treehole/anonymous-token`, A.accessToken);
  assert(at.body.code === 0, '换 anonToken');
  const anonToken = at.body.data.anonToken;

  const post1 = await call('POST', `/treehole/posts`, anonToken, {
    content: 'smoke 帖', mood: 'emo',
  });
  assert(post1.body.code === 0, '发帖 mood=emo 合法');
  assert(post1.body.data.mood === 'emo', '帖 mood=emo');

  // 6) 发帖 mood 非法 -> 30003
  const post2 = await call('POST', `/treehole/posts`, anonToken, {
    content: 'smoke 帖2', mood: '不存在的mood',
  });
  assert(post2.body.code === 30003, `发帖非法 mood 30003 got ${post2.body.code}`);

  // 7) admin CRUD 标签
  const tagName = `测${sfx.slice(-4)}`; // ≤12 字符
  const c = await call('POST', `/admin/anon-tags`, adm.accessToken, {
    name: tagName, category: 'interest', sortOrder: 99,
  });
  assert(c.body.code === 0, 'admin 创建标签');
  const tagId = c.body.data.id;

  // 重复创建 -> 30005
  const c2 = await call('POST', `/admin/anon-tags`, adm.accessToken, {
    name: tagName, category: 'interest',
  });
  assert(c2.body.code === 30005, `重复创建 30005 got ${c2.body.code}`);

  // 非法 category -> 30004
  const c3 = await call('POST', `/admin/anon-tags`, adm.accessToken, {
    name: 'x', category: 'unknown',
  });
  assert(c3.body.code === 30004, `非法 category 30004 got ${c3.body.code}`);

  // 更新 sortOrder
  const u = await call('PUT', `/admin/anon-tags/${tagId}`, adm.accessToken, { sortOrder: 1 });
  assert(u.body.code === 0 && u.body.data.sortOrder === 1, 'admin 更新 sortOrder');

  // 停用
  const off = await call('PUT', `/admin/anon-tags/${tagId}`, adm.accessToken, { active: false });
  assert(off.body.code === 0 && off.body.data.active === false, 'admin 停用标签');
  // 停用后公开库不返回
  const tags2 = await call('GET', `/treehole/tags`);
  assert(!tags2.body.data.interest.some((t) => t.name === tagName), '停用后公开库不含');

  // 删除
  const d = await call('DELETE', `/admin/anon-tags/${tagId}`, adm.accessToken);
  assert(d.body.code === 0 && d.body.data.deleted === true, 'admin 删除标签');
  // 再删 -> 30006
  const d2 = await call('DELETE', `/admin/anon-tags/${tagId}`, adm.accessToken);
  assert(d2.body.code === 30006, `重复删 30006 got ${d2.body.code}`);

  console.log('\n[P1-13 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-13 smoke] STOPPED:', e.message);
  process.exit(1);
});
