/**
 * P2-01 + P2-02 smoke：置顶最热帖子 + 今日上头
 * 前置：server dev 模式；需先有若干已审核公开帖（带点赞/评论）
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(code, nickname) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${BASE}/auth/wx-login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, role: 'user', nickname }),
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
  console.log('[P2-01+P2-02 smoke] base =', BASE);
  const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(-4)}`;

  // 作者 A 发 3 条公开帖；B/C 点赞制造热度差
  const A = await login(`A${sfx}`, `Author_${sfx}`);
  await sleep(14000);
  const B = await login(`B${sfx}`, `LikerB_${sfx}`);
  await sleep(14000);
  const C = await login(`C${sfx}`, `LikerC_${sfx}`);
  await sleep(14000);

  // 先拿 circles（发帖需要 circleId）
  const circles = await call('GET', '/circles', A.accessToken);
  assert(circles.body.code === 0 && circles.body.data.length > 0, '有圈子可用');
  const circleId = circles.body.data[0].id;

  // 发 3 条帖（content 内嵌 sfx 便于识别；P1-11 公开帖直接 APPROVED）
  const postIds = [];
  for (let i = 0; i < 3; i++) {
    const p = await call('POST', `/circles/${circleId}/posts`, A.accessToken, {
      content: `P2测试帖${i}_${sfx}`,
      images: [],
      isAnonymous: false,
      visibility: 'PUBLIC',
    });
    assert(p.body.code === 0, `发帖 ${i} 成功`);
    postIds.push(p.body.data.id);
  }
  const [p0, p1, p2] = postIds;

  // 热度：p0 得 2 赞，p1 得 1 赞，p2 得 0 赞
  await call('POST', `/posts/${p0}/like`, B.accessToken);
  await call('POST', `/posts/${p0}/like`, C.accessToken);
  await call('POST', `/posts/${p1}/like`, B.accessToken);

  // ===== P2-01 hot-top =====
  const hotTop = await call('GET', '/posts/hot-top?limit=10', A.accessToken);
  assert(hotTop.body.code === 0, 'hot-top 接口');
  assert(Array.isArray(hotTop.body.data.list), 'hot-top 返回 list 数组');
  assert(hotTop.body.data.list.length > 0, 'hot-top 非空');
  // p0（2 赞）应排在 p1（1 赞）之前
  const idxP0 = hotTop.body.data.list.findIndex((x) => x.id === p0);
  const idxP1 = hotTop.body.data.list.findIndex((x) => x.id === p1);
  assert(idxP0 >= 0 && idxP1 >= 0, 'hot-top 含 p0/p1');
  assert(idxP0 < idxP1, `p0(2赞) 排在 p1(1赞) 前 got p0@${idxP0} p1@${idxP1}`);
  // limit 生效
  const hotTopSmall = await call('GET', '/posts/hot-top?limit=2', A.accessToken);
  assert(hotTopSmall.body.data.list.length <= 2, `limit=2 截断 got ${hotTopSmall.body.data.list.length}`);
  // VO 含 liked 状态（A 未赞 p0，liked=false）
  const p0Vo = hotTop.body.data.list.find((x) => x.id === p0);
  assert(p0Vo.liked === false, 'hot-top VO 含 liked 字段');

  // ===== P2-02 today-hit =====
  const today = await call('GET', '/posts/today-hit?page=1&pageSize=20', A.accessToken);
  assert(today.body.code === 0, 'today-hit 接口');
  assert(Array.isArray(today.body.data.list) && today.body.data.list.length >= 3, 'today-hit 含刚发 3 帖');
  assert(typeof today.body.data.total === 'number' && today.body.data.total >= 3, `today-hit total>=3 got ${today.body.data.total}`);
  // 近 24h：含刚发帖
  const tIdxP0 = today.body.data.list.findIndex((x) => x.id === p0);
  assert(tIdxP0 >= 0, 'today-hit 含 p0');
  // 排序：p0 在 p1 前
  const tIdxP1 = today.body.data.list.findIndex((x) => x.id === p1);
  assert(tIdxP0 < tIdxP1, `today-hit p0 排 p1 前 got p0@${tIdxP0} p1@${tIdxP1}`);

  // 分页：pageSize=1 第 1 页 1 条，total 不变
  const page1 = await call('GET', '/posts/today-hit?page=1&pageSize=1', A.accessToken);
  assert(page1.body.data.list.length === 1, `pageSize=1 返回 1 条 got ${page1.body.data.list.length}`);
  assert(page1.body.data.total === today.body.data.total, '分页 total 一致');

  console.log('\n[P2-01+P2-02 smoke] ALL PASSED');
})().catch((e) => {
  console.error('\n[P2-01+P2-02 smoke] STOPPED:', e.message);
  process.exit(1);
});
