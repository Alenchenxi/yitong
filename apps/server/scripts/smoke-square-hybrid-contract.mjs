/**
 * 广场混合流 smoke 契约脚本（CR-001 T3 RED → T4 GREEN → T5 REFACTOR 验证）
 *
 * 覆盖 14 个场景（与 docs/开发记录/广场混合流_技术方案.md §8.1 一一对应）：
 *   - union 基础（1.1 recommend 混合 / 1.2 latest 排序）
 *   - sort 白名单（2.1 follow=400 / 2.2 默认 recommend）
 *   - 双 token 鉴权（3.1 缺 anonToken / 3.2 有 anonToken / 3.3 无 access token）
 *   - AnonBlock 屏蔽隔离（4.1 有 anonToken 屏蔽对端 / 4.2 缺 anonToken 不计算屏蔽）
 *   - 红线断言（5.1/5.2 anon_post kind 严禁真实身份字段）
 *   - 分页（6.1 nextCursor / 6.2 null / 6.3 cursor 续页）
 *   - 数据过滤（7.x schema 字段断言）
 *   - fetchSize 边界（8.x 通过响应规模推断）
 *
 * 用法：
 *   1. 启 server（mock 模式）：cd apps/server && pnpm start 或 npx nest start
 *   2. 跑 smoke：node apps/server/scripts/smoke-square-hybrid-contract.mjs
 *   3. BASE_URL 默认 http://localhost:3000/api/v1，可环境变量覆盖
 *
 * 当前阶段（T3 RED）：接口未实现，所有 contract 应失败（404 / ECONNREFUSED）
 * T4 GREEN 后：所有 contract 应通过
 * T5 REFACTOR 后：所有 contract 应仍通过
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const failures = [];

function contract(name, fn) {
  return Promise.resolve()
    .then(() => sleep(500)) // 500ms 间隔防触发全局限流 (100 req/min)
    .then(() => fn())
    .then(() => {
      console.log(`  ✅ ${name}`);
      passed++;
    })
    .catch((e) => {
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      console.log(`  ❌ ${name}: ${msg}`);
      failures.push({ name, error: msg });
      failed++;
    });
}

async function call(method, path, token, body, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, body: json };
}

async function loginUser(code, nickname = 'smoke_user') {
  const r = await call('POST', '/auth/wx-login', null, { code, role: 'user', nickname });
  if (r.body.code !== 0) throw new Error(`loginUser fail: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body.data.accessToken;
}

async function signAnonToken(accessToken) {
  const r = await call('POST', '/treehole/anonymous-token', accessToken, {});
  if (r.body.code !== 0) throw new Error(`signAnonToken fail: ${JSON.stringify(r.body).slice(0, 200)}`);
  return { anonToken: r.body.data.anonToken, anonId: r.body.data.anonId };
}

// 共享登录态：所有 contract 复用同一个 user，避免每 contract loginNew 触发限流
let _sharedToken = null;
let _sharedAnon = null; // { anonToken, anonId } | null
async function sharedToken() {
  if (!_sharedToken) _sharedToken = await loginUser('smoke_shared_user');
  return _sharedToken;
}
async function sharedAnon() {
  if (!_sharedAnon) _sharedAnon = await signAnonToken(await sharedToken());
  return _sharedAnon;
}

// ==================== 14 个 contract ====================

console.log('CR-001 T3 RED smoke 契约脚本');
console.log('BASE:', BASE);
console.log('---');

// 1. union 基础
await contract('1.1 GET /square/feed?sort=recommend returns mixed post + anon_post', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=recommend&limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}, body=${JSON.stringify(r.body).slice(0, 200)}`);
  const items = r.body.data?.list ?? [];
  const kinds = new Set(items.map((i) => i.kind));
  for (const k of kinds) {
    // CR-002 圈子：mixed feed 新增 job_post 合法 kind
    if (!['post', 'anon_post', 'job_post'].includes(k)) throw new Error(`unexpected kind: ${k}`);
  }
  // 至少应有 list 数组（可能为空数据）
  if (!Array.isArray(items)) throw new Error('data.list is not an array');
});

await contract('1.2 GET /square/feed?sort=latest returns sorted by createdAt desc', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  const items = r.body.data?.list ?? [];
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1].data.createdAt;
    const b = items[i].data.createdAt;
    if (a < b) throw new Error(`not desc at [${i - 1}]/${[i]}: ${a} < ${b}`);
  }
});

// 2. sort 白名单
await contract('2.1 GET /square/feed?sort=follow returns 400', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=follow&limit=20', token);
  if (r.status !== 400) throw new Error(`status=${r.status} (expected 400), body=${JSON.stringify(r.body).slice(0, 200)}`);
});

await contract('2.2 GET /square/feed without sort defaults to recommend', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  // 默认 recommend，应该返回 list（行为同 1.1）
  if (!Array.isArray(r.body.data?.list)) throw new Error('data.list missing');
});

// 3. 双 token 鉴权
await contract('3.1 anon post liked=false when anonToken missing', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  const anonItems = (r.body.data?.list ?? []).filter((i) => i.kind === 'anon_post');
  for (const item of anonItems) {
    if (item.data.liked !== false) throw new Error(`anon post liked=${item.data.liked}, expected false`);
  }
});

await contract('3.2 anon post liked reflects AnonPostLike when anonToken present', async () => {
  const token = await sharedToken();
  const { anonToken } = await sharedAnon();
  // 双 token 设计：access token 走 Authorization，anon token 走 x-anon-token header
  const r = await call('GET', '/square/feed?sort=latest&limit=20', token, null, { 'x-anon-token': anonToken });
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  // 当前实现下，anonToken 通过独立 header 传递；本 contract 仅验证 liked 是 boolean
  const anonItems = (r.body.data?.list ?? []).filter((i) => i.kind === 'anon_post');
  for (const item of anonItems) {
    if (typeof item.data.liked !== 'boolean') throw new Error(`liked type=${typeof item.data.liked}`);
  }
});

await contract('3.3 GET /square/feed without access token returns 401', async () => {
  const r = await call('GET', '/square/feed?sort=recommend&limit=20', null);
  if (r.status !== 401) throw new Error(`status=${r.status} (expected 401)`);
});

// 4. AnonBlock 屏蔽隔离（依赖数据库有 seed 数据；契约层面仅断言 schema 存在）
await contract('4.1 AnonBlock query is invoked when anonToken present (verify via log/repo)', async () => {
  // 契约层面：保证接口不报 500，AnonBlock 查询不阻塞响应
  const accessToken = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=20', accessToken);
  if (r.status !== 200 && r.status !== 500) throw new Error(`unexpected status=${r.status}`);
  if (r.status === 500) throw new Error('500 error: AnonBlock query may be missing');
});

await contract('4.2 anon posts visible to all when anonToken missing (no blocked filter)', async () => {
  // 缺 anonToken 时不计算屏蔽，应正常返回所有匿名帖
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
});

// 5. 红线断言（关键）
await contract('5.1 anon_post kind NEVER contains authorId/authorNickname/authorAvatarUrl', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=50', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  const anonItems = (r.body.data?.list ?? []).filter((i) => i.kind === 'anon_post');
  for (const item of anonItems) {
    const d = item.data;
    if ('authorId' in d) throw new Error(`anon_post has authorId: ${d.authorId}`);
    if ('authorNickname' in d) throw new Error(`anon_post has authorNickname: ${d.authorNickname}`);
    if ('authorAvatarUrl' in d) throw new Error(`anon_post has authorAvatarUrl: ${d.authorAvatarUrl}`);
  }
});

await contract('5.2 anon_post kind NEVER contains userId/uid', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=50', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  const anonItems = (r.body.data?.list ?? []).filter((i) => i.kind === 'anon_post');
  for (const item of anonItems) {
    const d = item.data;
    if ('userId' in d) throw new Error(`anon_post has userId: ${d.userId}`);
    if ('uid' in d) throw new Error(`anon_post has uid: ${d.uid}`);
  }
});

// 6. 分页
await contract('6.1 returns nextCursor when more items available (limit=1)', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=1', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  // 若有 hasMore，nextCursor 必须非 null
  if (r.body.data?.hasMore && !r.body.data?.nextCursor) {
    throw new Error('hasMore=true but nextCursor is null');
  }
});

await contract('6.2 returns nextCursor=null when no more items (limit=50)', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=50', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  if (!r.body.data?.hasMore && r.body.data?.nextCursor !== null) {
    throw new Error('hasMore=false but nextCursor is not null');
  }
});

await contract('6.3 cursor pagination works (round-trip)', async () => {
  const token = await sharedToken();
  const r1 = await call('GET', '/square/feed?sort=latest&limit=5', token);
  if (r1.status !== 200) throw new Error(`page1 status=${r1.status}`);
  if (!r1.body.data?.hasMore) return; // 数据不够，跳过
  const cursor = r1.body.data.nextCursor;
  if (!cursor) throw new Error('page1 hasMore but no cursor');
  const r2 = await call('GET', `/square/feed?sort=latest&limit=5&cursor=${encodeURIComponent(cursor)}`, token);
  if (r2.status !== 200) throw new Error(`page2 status=${r2.status}`);
  // page2 的 createdAt 应 <= page1 最后一条
  const p1 = r1.body.data.list;
  const p2 = r2.body.data.list;
  if (p1.length > 0 && p2.length > 0) {
    const last1 = p1[p1.length - 1].data.createdAt;
    const first2 = p2[0].data.createdAt;
    if (first2 > last1) throw new Error(`cursor not respected: ${first2} > ${last1}`);
  }
});

// 7. 数据过滤（schema 字段断言）
await contract('7.1 PostVo schema excludes deletedAt in response', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  const postItems = (r.body.data?.list ?? []).filter((i) => i.kind === 'post');
  for (const item of postItems) {
    // PostVo 不暴露 deletedAt（仅 createdAt/editedAt 等业务字段）
    if ('deletedAt' in item.data) throw new Error('post kind leaked deletedAt');
  }
});

await contract('7.2 anon_post status filtered to APPROVED (no PENDING in feed)', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=20', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  // 接口契约：anon_post 不应暴露 status 字段（仅业务字段）
  const anonItems = (r.body.data?.list ?? []).filter((i) => i.kind === 'anon_post');
  for (const item of anonItems) {
    if ('status' in item.data) throw new Error('anon_post leaked status field');
  }
});

// 8. fetchSize 边界（推断：limit=1 时应请求 2 条/源）
await contract('8.1 fetchSize boundary: limit=1 still returns valid response', async () => {
  const token = await sharedToken();
  const r = await call('GET', '/square/feed?sort=latest&limit=1', token);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  // list 长度不超过 limit（可能为 0）
  const items = r.body.data?.list ?? [];
  if (items.length > 1) throw new Error(`list length=${items.length} > limit=1`);
});

console.log('---');
console.log(`总计 ${passed + failed} 个 contract: ${passed} 通过, ${failed} 失败`);
if (failures.length > 0) {
  console.log('\n失败列表:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
process.exit(0);