/**
 * admin polish smoke（feat/admin-polish-batch）：
 *   B 工单回复通知（用户端收到 TICKET_REPLY 通知）
 *   C 帖子分页（admin/posts 分页 + keyword 过滤 + queue 精简）
 *   D 标签增强（admin/anon-tags 创建/改名/改排序 + 按分类筛选）
 *   F 评论置顶（admin/comments 分页 + pin/unpin）
 *
 * 前置：docker postgres/redis 已起 + server 已起（npx nest start）+ mock 模式。
 * 用法：node apps/server/scripts/smoke-admin-polish.mjs
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname, role = 'user') {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role, nickname }),
    });
    const j = await r.json();
    if (j.code === 0) return j.data;
    if (r.status === 429) { await sleep(14000); continue; }
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
  console.log('[admin-polish smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;
  const U = await login(`polishU${sfx}`, `PolishU_${sfx}`, 'user');
  await sleep(14000);
  const admin = await login('admin', '管理员', 'admin');

  // =============================================================
  // B 工单回复通知（用户收到 TICKET_REPLY + 工单状态切换）
  // =============================================================
  console.log('\n[B] 工单回复通知');
  const t = await call('POST', '/support/tickets', U.accessToken, {
    title: `B工单_${sfx}`,
    content: 'smoke 测试工单',
  });
  assert(t.body.code === 0, `user 创建工单 code=0 got ${JSON.stringify(t.body)}`);
  const tid = t.body.data.id;

  // admin 先回复 close=true -> status=CLOSED + 通知标题含「关闭」
  const replyClose = await call('POST', `/admin/tickets/${tid}/reply`, admin.accessToken, {
    reply: '测试回复关闭',
    close: true,
  });
  assert(replyClose.body.code === 0, `admin reply close code=0 got ${JSON.stringify(replyClose.body)}`);
  assert(replyClose.body.data.status === 'CLOSED', `reply close=true -> CLOSED got ${replyClose.body.data.status}`);

  // user 端查通知，找 type=ticket_reply 且 targetId=tid
  await sleep(500);
  const notesAll = await call('GET', '/notifications', U.accessToken);
  assert(notesAll.body.code === 0, `user 拉通知 code=0 got ${JSON.stringify(notesAll.body)}`);
  const noteList = notesAll.body.data.list;
  const matched = noteList.find((n) => n.type === 'ticket_reply' && n.targetId === tid);
  assert(!!matched, `通知列表含 type=ticket_reply 且 targetId=${tid} got=${JSON.stringify(noteList.map((n) => ({ type: n.type, targetId: n.targetId })))}`);
  assert(typeof matched.title === 'string' && matched.title.includes('关闭'), `通知标题含「关闭」got=${matched.title}`);

  // =============================================================
  // B-2 再 reply close=false -> IN_PROGRESS + 通知标题含「已回复」
  // =============================================================
  const replyOpen = await call('POST', `/admin/tickets/${tid}/reply`, admin.accessToken, {
    reply: '再次回复处理中',
    close: false,
  });
  assert(replyOpen.body.code === 0, `admin reply close=false code=0 got ${JSON.stringify(replyOpen.body)}`);
  assert(replyOpen.body.data.status === 'IN_PROGRESS', `reply close=false -> IN_PROGRESS got ${replyOpen.body.data.status}`);

  await sleep(300);
  const notesAll2 = await call('GET', '/notifications', U.accessToken);
  const matched2 = notesAll2.body.data.list.find(
    (n) => n.type === 'ticket_reply' && n.targetId === tid && (n.content === '再次回复处理中'),
  );
  assert(!!matched2, `再次回复有通知（content=再次回复处理中）`);
  assert(typeof matched2.title === 'string' && matched2.title.includes('已回复'), `再次通知标题含「已回复」got=${matched2.title}`);

  // =============================================================
  // C 帖子分页管理
  // =============================================================
  console.log('\n[C] 帖子分页');
  // 需要有足够帖子供分页；先发几个帖
  const circles = await call('GET', '/circles', U.accessToken);
  assert(circles.body.code === 0, `GET /circles code=0`);
  const circleId = circles.body.data[0].id;

  const uniqKey = `polishsmoke_${sfx}`;
  // 发帖 5/min 限流——跨脚本累积，sleep 避开上一轮窗口
  await sleep(15000);
  const p0 = await call('POST', `/circles/${circleId}/posts`, U.accessToken, {
    content: `${uniqKey}_0 内容文案`,
    images: [],
    isAnonymous: false,
    visibility: 'PUBLIC',
  });
  assert(p0.body.code === 0, `发帖 #0 code=0 got ${p0.body.code}`);
  const createdIds = [p0.body.data.id];

  // page=1 pageSize=5
  const page1 = await call('GET', '/admin/posts?page=1&pageSize=5', admin.accessToken);
  assert(page1.body.code === 0, `admin posts page=1 code=0 got ${JSON.stringify(page1.body)}`);
  assert(Array.isArray(page1.body.data.list), `返回 list 数组 got=${typeof page1.body.data.list}`);
  assert(page1.body.data.page === 1 && page1.body.data.pageSize === 5, `page/pageSize 回填 got=${JSON.stringify({ p: page1.body.data.page, ps: page1.body.data.pageSize })}`);
  assert(typeof page1.body.data.total === 'number', `total 是 number got=${typeof page1.body.data.total}`);
  assert(page1.body.data.list.length <= 5, `list 长度 ≤ pageSize got=${page1.body.data.list.length}`);
  const page1Ids = new Set(page1.body.data.list.map((p) => p.id));
  assert(createdIds.every((id) => page1Ids.has(id)), `page1 至少包含我们创建的帖`);

  // page=2 不与 page=1 重复
  const page2 = await call('GET', '/admin/posts?page=2&pageSize=5', admin.accessToken);
  assert(page2.body.code === 0, `admin posts page=2 code=0`);
  const page2Ids = new Set(page2.body.data.list.map((p) => p.id));
  const overlap = [...page1Ids].filter((id) => page2Ids.has(id));
  assert(overlap.length === 0, `page=2 与 page=1 无重叠 id (overlap=${overlap.length})`);

  // keyword 过滤命中（用 uniqKey 全文搜）
  const search = await call(
    'GET',
    `/admin/posts?page=1&pageSize=10&keyword=${encodeURIComponent(uniqKey)}`,
    admin.accessToken,
  );
  assert(search.body.code === 0, `admin posts keyword code=0 got=${search.body.code}`);
  assert(search.body.data.list.length >= 1, `keyword 过滤命中 >=1 个帖 got=${search.body.data.list.length}`);
  assert(
    search.body.data.list.every((p) => p.content.includes(uniqKey)),
    `keyword 返回每条都含 uniqKey`,
  );

  // anon-posts 分页
  const anonPage = await call('GET', '/admin/anon-posts?page=1&pageSize=5', admin.accessToken);
  assert(anonPage.body.code === 0, `admin anon-posts code=0`);
  assert(Array.isArray(anonPage.body.data.list), `anon-posts list 数组 got=${typeof anonPage.body.data.list}`);
  assert(typeof anonPage.body.data.total === 'number', `anon-posts total number got=${typeof anonPage.body.data.total}`);
  assert(anonPage.body.data.page === 1 && anonPage.body.data.pageSize === 5, `anon-posts 回填 page/pageSize`);

  // queue 不含 posts/anonPosts（getQueue 精简）
  const queue = await call('GET', '/admin/queue', admin.accessToken);
  assert(queue.body.code === 0, `admin queue code=0`);
  assert(!('posts' in queue.body.data), `queue 不含 posts 字段 got keys=${Object.keys(queue.body.data).join(',')}`);
  assert(!('anonPosts' in queue.body.data), `queue 不含 anonPosts 字段`);
  assert('merchants' in queue.body.data, `queue 含 merchants`);
  assert('reports' in queue.body.data, `queue 含 reports`);

  // =============================================================
  // D 标签增强（rename + sortOrder + category 过滤）
  // =============================================================
  console.log('\n[D] 标签增强');
  const tagName = `s${sfx.slice(-10)}`; // ≤12 字符
  const renameName = `r${sfx.slice(-10)}`; // ≤12 字符
  const cTag = await call('POST', '/admin/anon-tags', admin.accessToken, {
    name: tagName,
    category: 'mood',
    sortOrder: 5,
  });
  assert(cTag.body.code === 0, `admin create anon-tag code=0 got=${JSON.stringify(cTag.body)}`);
  const tagId = cTag.body.data.id;
  assert(cTag.body.data.sortOrder === 5, `sortOrder=5 got=${cTag.body.data.sortOrder}`);

  // 改名 + 改排序
  const uTag = await call('PUT', `/admin/anon-tags/${tagId}`, admin.accessToken, {
    name: renameName,
    sortOrder: 10,
  });
  assert(uTag.body.code === 0, `admin update anon-tag code=0 got=${JSON.stringify(uTag.body)}`);
  assert(uTag.body.data.name === renameName, `rename 成功 got=${uTag.body.data.name}`);
  assert(uTag.body.data.sortOrder === 10, `sortOrder 改 10 got=${uTag.body.data.sortOrder}`);

  // 按 category=mood 过滤
  const moodList = await call('GET', '/admin/anon-tags?category=mood', admin.accessToken);
  assert(moodList.body.code === 0, `list anon-tags category=mood code=0`);
  assert(Array.isArray(moodList.body.data), `list 返回数组`);
  assert(
    moodList.body.data.every((t) => t.category === 'mood'),
    `仅返回 mood 类 got=${[...new Set(moodList.body.data.map((t) => t.category))].join(',')}`,
  );
  assert(
    moodList.body.data.some((t) => t.id === tagId && t.name === renameName),
    `能找到我们刚改名的标签`,
  );

  // 按 category=interest 不应返回 mood 类
  const intList = await call('GET', '/admin/anon-tags?category=interest', admin.accessToken);
  assert(
    intList.body.data.every((t) => t.category === 'interest'),
    `interest 类无 mood 混入`,
  );

  // 清理：删标签
  const dTag = await call('DELETE', `/admin/anon-tags/${tagId}`, admin.accessToken);
  assert(dTag.body.code === 0 && dTag.body.data.deleted === true, `删除标签`);

  // =============================================================
  // F 评论置顶
  // =============================================================
  console.log('\n[F] 评论置顶');
  // 取一棵表白墙帖（用 page1 第一条或自己建的）
  const targetPostId = createdIds[0];
  // 先发 2 条评论（admin 操作 post 用户评论即可，用 U 也可以同账号评论）
  const c1 = await call('POST', `/posts/${targetPostId}/comments`, U.accessToken, {
    content: `评论A_${sfx}`,
  });
  assert(c1.body.code === 0, `评论 A code=0 got=${JSON.stringify(c1.body)}`);
  const cidA = c1.body.data.id;
  const c2 = await call('POST', `/posts/${targetPostId}/comments`, U.accessToken, {
    content: `评论B_${sfx}`,
  });
  assert(c2.body.code === 0, `评论 B code=0`);
  const cidB = c2.body.data.id;

  // admin 拿该帖评论列表
  const comments = await call(
    'GET',
    `/admin/comments?postId=${targetPostId}&page=1&pageSize=5`,
    admin.accessToken,
  );
  assert(comments.body.code === 0, `admin comments list code=0 got=${JSON.stringify(comments.body)}`);
  assert(Array.isArray(comments.body.data.list), `comments list 数组`);
  assert(comments.body.data.list.length >= 2, `至少 2 条评论 got=${comments.body.data.list.length}`);
  const c0 = comments.body.data.list[0];
  const requiredKeys = ['id', 'content', 'postId', 'postTitle', 'likeCount', 'pinned', 'createdAt'];
  const missingKeys = requiredKeys.filter((k) => !(k in c0));
  assert(missingKeys.length === 0, `每条评论含必需字段（缺 ${missingKeys.join(',')}）`);

  // 置顶 cidA
  const pin = await call('POST', `/admin/comments/${cidA}/pin`, admin.accessToken, { pinned: true });
  assert(pin.body.code === 0 && pin.body.data.pinned === true, `置顶成功 got=${JSON.stringify(pin.body)}`);

  // 重新拉，确认置顶=true 且置顶项排前
  const comments2 = await call(
    'GET',
    `/admin/comments?postId=${targetPostId}&page=1&pageSize=5`,
    admin.accessToken,
  );
  const pinnedItem = comments2.body.data.list.find((c) => c.id === cidA);
  assert(!!pinnedItem, `置顶后列表仍含 cidA`);
  assert(pinnedItem.pinned === true, `置顶项 pinned=true got=${pinnedItem?.pinned}`);
  // 排序：pinned desc -> cidA 应当排在最前
  assert(
    comments2.body.data.list[0].id === cidA,
    `置顶项排在最前 got top=${comments2.body.data.list[0].id}`,
  );

  // 取消置顶
  const unpin = await call('POST', `/admin/comments/${cidA}/pin`, admin.accessToken, { pinned: false });
  assert(unpin.body.code === 0 && unpin.body.data.pinned === false, `取消置顶成功 got=${JSON.stringify(unpin.body)}`);

  const comments3 = await call(
    'GET',
    `/admin/comments?postId=${targetPostId}&page=1&pageSize=5`,
    admin.accessToken,
  );
  const unPinned = comments3.body.data.list.find((c) => c.id === cidA);
  assert(!!unPinned && unPinned.pinned === false, `取消置顶后 pinned=false`);

  console.log('\n[admin-polish smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[admin-polish smoke] STOPPED:', e.message);
  process.exit(1);
});
