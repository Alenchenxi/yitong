/**
 * P2-03 + P2-04 smoke：活动专题 + 校园话题运营
 * 前置：server dev 模式；seed admin（login code='admin' role='admin'）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 3; i++) {
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
  console.log('[P2-03+P2-04 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const A = await login(`A${sfx}`, `Author_${sfx}`);
  await sleep(14000);
  const admin = await login('admin', '管理员', 'admin');

  // 发 2 帖供关联
  const circles = await call('GET', '/circles', A.accessToken);
  const circleId = circles.body.data[0].id;
  const p1 = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: `P2-03帖1_${sfx}`, images: [], isAnonymous: false, visibility: 'PUBLIC',
  });
  const p2 = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
    content: `P2-04帖2_${sfx}`, images: [], isAnonymous: false, visibility: 'PUBLIC',
  });
  const pid1 = p1.body.data.id;
  const pid2 = p2.body.data.id;

  // ===== P2-03 活动专题 =====
  // admin 建专题（DRAFT）-> 前台不可见
  const at1 = await call('POST', '/admin/activity-topics', admin.accessToken, {
    title: `开学季_${sfx}`, description: '开学活动', status: 'DRAFT',
  });
  assert(at1.body.code === 0, '建活动专题（草稿）');
  const atId = at1.body.data.id;
  const listDraft = await call('GET', '/activity-topics', A.accessToken);
  assert(!listDraft.body.data.find((t) => t.id === atId), '草稿专题前台不可见');

  // 发布专题
  const pub = await call('PUT', `/admin/activity-topics/${atId}`, admin.accessToken, { status: 'PUBLISHED' });
  assert(pub.body.data.status === 'PUBLISHED', '发布专题');

  // 加帖到专题
  const add1 = await call('POST', `/admin/activity-topics/${atId}/posts`, admin.accessToken, { postId: pid1, sortOrder: 1 });
  assert(add1.body.code === 0, '专题加帖 p1');
  const add2 = await call('POST', `/admin/activity-topics/${atId}/posts`, admin.accessToken, { postId: pid2, sortOrder: 2 });
  assert(add2.body.code === 0, '专题加帖 p2');

  // 重复加帖 20002
  const dup = await call('POST', `/admin/activity-topics/${atId}/posts`, admin.accessToken, { postId: pid1 });
  assert(dup.body.code === 20002, `重复加帖 20002 got ${dup.body.code}`);

  // 前台专题详情含 2 帖
  const detail = await call('GET', `/activity-topics/${atId}`, A.accessToken);
  assert(detail.body.code === 0, '前台专题详情');
  assert(detail.body.data.topic.title === `开学季_${sfx}`, '专题标题正确');
  assert(detail.body.data.posts.length === 2, `专题含 2 帖 got ${detail.body.data.posts.length}`);
  assert(detail.body.data.posts[0].id === pid1, 'sortOrder 排序 p1 在前');

  // 移帖
  await call('DELETE', `/admin/activity-topics/${atId}/posts/${pid1}`, admin.accessToken);
  const detail2 = await call('GET', `/activity-topics/${atId}`, A.accessToken);
  assert(detail2.body.data.posts.length === 1, '移帖后剩 1 帖');

  // 非管理员不能建专题
  const forbid = await call('POST', '/admin/activity-topics', A.accessToken, { title: 'x' });
  assert(forbid.body.code === 10003, `非管理员建专题 10003 got ${forbid.body.code}`);

  // 删专题（级联）
  await call('DELETE', `/admin/activity-topics/${atId}`, admin.accessToken);
  const gone = await call('GET', `/activity-topics/${atId}`, A.accessToken);
  assert(gone.body.code === 20001, '删除后专题不存在 20001');

  // ===== P2-04 校园话题 =====
  // 建话题（PUBLISHED）
  const t1 = await call('POST', '/admin/topics', admin.accessToken, {
    name: `开学日常_${sfx}`, description: '开学那些事', status: 'PUBLISHED',
  });
  assert(t1.body.code === 0, '建话题');
  const tId = t1.body.data.id;

  // 重名 20002
  const dupT = await call('POST', '/admin/topics', admin.accessToken, { name: `开学日常_${sfx}` });
  assert(dupT.body.code === 20002, `重名话题 20002 got ${dupT.body.code}`);

  // 帖子归入话题
  const setT = await call('POST', `/admin/posts/${pid1}/topic`, admin.accessToken, { topicId: tId });
  assert(setT.body.code === 0, '帖子归入话题');

  // 前台话题列表含 postCount
  const tlist = await call('GET', '/topics', A.accessToken);
  const tItem = tlist.body.data.find((t) => t.id === tId);
  assert(!!tItem, '话题列表含该话题');
  assert(tItem.postCount === 1, `postCount=1 got ${tItem.postCount}`);

  // 话题详情 + 帖子
  const tdetail = await call('GET', `/topics/${tId}`, A.accessToken);
  assert(tdetail.body.code === 0, '话题详情');
  assert(tdetail.body.data.topic.name === `开学日常_${sfx}`, '话题名正确');
  assert(tdetail.body.data.posts.list.length === 1, '话题含 1 帖');
  assert(tdetail.body.data.posts.list[0].id === pid1, '话题帖为 p1');

  // 取消归入（topicId=null）
  await call('POST', `/admin/posts/${pid1}/topic`, admin.accessToken, { topicId: null });
  const tdetail2 = await call('GET', `/topics/${tId}`, A.accessToken);
  assert(tdetail2.body.data.posts.list.length === 0, '取消归入后话题 0 帖');
  assert(tdetail2.body.data.topic.postCount === 0, 'postCount=0');

  // 删话题（posts.topicId SET NULL）
  await call('DELETE', `/admin/topics/${tId}`, admin.accessToken);
  const tgone = await call('GET', `/topics/${tId}`, A.accessToken);
  assert(tgone.body.code === 20001, '删除后话题不存在 20001');

  console.log('\n[P2-03+P2-04 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-03+P2-04 smoke] STOPPED:', e.message);
  process.exit(1);
});
