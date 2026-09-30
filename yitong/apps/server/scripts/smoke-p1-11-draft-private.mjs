/**
 * P1-11 smoke：草稿 / 私密投稿
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
  console.log('[P1-11 smoke] base =', BASE);
  const sfx = Date.now().toString(36).slice(-8);
  const A = await login(`dp-A-${sfx}-aaaa`, `DpA_${sfx}`);
  await sleep(LOGIN_GAP_MS);
  const B = await login(`dp-B-${sfx}-bbbb`, `DpB_${sfx}`);
  const circle = (await call('GET', '/circles', A.accessToken)).body.data[0];

  // 1) 草稿 / 私密 / 公开各发一篇
  const draft = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, {
    content: '我的草稿 1', visibility: 'DRAFT',
  });
  assert(draft.body.code === 0 && draft.body.data.visibility === 'DRAFT', 'create DRAFT');
  const draftId = draft.body.data.id;

  const priv = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, {
    content: '我的私密 1', visibility: 'PRIVATE',
  });
  assert(priv.body.code === 0 && priv.body.data.visibility === 'PRIVATE', 'create PRIVATE');
  const privId = priv.body.data.id;

  const pub = await call('POST', `/circles/${circle.id}/posts`, A.accessToken, {
    content: '公开 1', visibility: 'PUBLIC',
  });
  assert(pub.body.code === 0 && pub.body.data.visibility === 'PUBLIC', 'create PUBLIC');
  const pubId = pub.body.data.id;

  // 2) 他人：B 调 getPost 看 A 的 draft / private 应找不到（20003）
  const bGetDraft = await call('GET', `/posts/${draftId}`, B.accessToken);
  assert(bGetDraft.body.code === 20003, 'B 看 A draft 20003');
  const bGetPriv = await call('GET', `/posts/${privId}`, B.accessToken);
  assert(bGetPriv.body.code === 20003, 'B 看 A private 20003');
  // B 看 public 应 OK
  const bGetPub = await call('GET', `/posts/${pubId}`, B.accessToken);
  assert(bGetPub.body.code === 0, 'B 看 A public OK');

  // 3) 自己：A 可读自己所有
  for (const id of [draftId, privId, pubId]) {
    const r = await call('GET', `/posts/${id}`, A.accessToken);
    assert(r.body.code === 0, `A read ${id}`);
  }

  // 4) 我的草稿 / 私密列表
  const myDrafts = await call('GET', `/posts/mine/drafts?page=1&pageSize=20`, A.accessToken);
  assert(myDrafts.body.code === 0, 'my drafts');
  assert(myDrafts.body.data.list.some((p) => p.id === draftId), 'DRAFT 出现在我的草稿');
  assert(!myDrafts.body.data.list.some((p) => p.id === privId), 'PRIVATE 不在我的草稿');
  assert(!myDrafts.body.data.list.some((p) => p.id === pubId), 'PUBLIC 不在我的草稿');

  const myPrivate = await call('GET', `/posts/mine/private?page=1&pageSize=20`, A.accessToken);
  assert(myPrivate.body.code === 0, 'my private');
  assert(myPrivate.body.data.list.some((p) => p.id === privId), 'PRIVATE 出现在我的私密');
  assert(!myPrivate.body.data.list.some((p) => p.id === draftId), 'DRAFT 不在我的私密');

  // 5) 我的发布（含 3 种 + 软删）
  const myPosts = await call('GET', `/posts/mine`, A.accessToken);
  assert(myPosts.body.data.list.some((p) => p.id === draftId), 'draft 在我的发布');
  assert(myPosts.body.data.list.some((p) => p.id === privId), 'private 在我的发布');
  assert(myPosts.body.data.list.some((p) => p.id === pubId), 'public 在我的发布');

  // 6) feed / search / 我点赞的（只 PUBLIC）
  const feed = await call('GET', `/posts/feed?limit=50`, A.accessToken);
  assert(!feed.body.data.list.some((p) => p.id === draftId), 'DRAFT 不在 feed');
  assert(!feed.body.data.list.some((p) => p.id === privId), 'PRIVATE 不在 feed');
  assert(feed.body.data.list.some((p) => p.id === pubId), 'PUBLIC 在 feed');

  // 7) 编辑草稿 -> 改 public（验证 PUT 支持 visibility 改）
  const draftToPub = await call('PUT', `/posts/${draftId}`, A.accessToken, {
    content: '草稿改为公开', visibility: 'PUBLIC',
  });
  assert(draftToPub.body.code === 0 && draftToPub.body.data.visibility === 'PUBLIC', 'PUT 改 DRAFT -> PUBLIC');
  const feed2 = await call('GET', `/posts/feed?limit=50`, A.accessToken);
  assert(feed2.body.data.list.some((p) => p.id === draftId), '改 PUBLIC 后进 feed');

  // 8) 编辑公开 -> 私密（验证）
  const pubToPriv = await call('PUT', `/posts/${pubId}`, A.accessToken, {
    content: '公开改私密', visibility: 'PRIVATE',
  });
  assert(pubToPriv.body.data.visibility === 'PRIVATE', 'PUT 改 PUBLIC -> PRIVATE');
  const feed3 = await call('GET', `/posts/feed?limit=50`, A.accessToken);
  assert(!feed3.body.data.list.some((p) => p.id === pubId), '改 PRIVATE 后不在 feed');

  // 9) 我的草稿 / 私密 list 数量变化
  const draftsAfter = await call('GET', `/posts/mine/drafts?page=1&pageSize=20`, A.accessToken);
  assert(!draftsAfter.body.data.list.some((p) => p.id === draftId), '原 DRAFT 已不在我的草稿');
  const privateAfter = await call('GET', `/posts/mine/private?page=1&pageSize=20`, A.accessToken);
  assert(privateAfter.body.data.list.some((p) => p.id === pubId), 'PUBLIC 转 PRIVATE 后在我的私密');

  console.log('\n[P1-11 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P1-11 smoke] STOPPED:', e.message);
  process.exit(1);
});
