// 授权服务器 Worker 本地测试（mock KV，跑实际 worker.js；不依赖 Cloudflare）
// 运行：node infra/license-server/worker.test.mjs
import worker from './worker.js';

const API_KEY = 'test-api-key';
const MASTER_KEY = 'test-master-key';

function mockKv() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, v); },
    delete: async (k) => { m.delete(k); },
  };
}

const env = { LICENSE_KV: mockKv(), LICENSE_API_KEY: API_KEY, LICENSE_MASTER_KEY: MASTER_KEY };

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

async function call(method, path, { body, headers } = {}) {
  const init = { method, headers: headers || {} };
  if (body !== undefined) {
    init.headers['content-type'] = init.headers['content-type'] || 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await worker.fetch(new Request(`http://license.test${path}`, init), env);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('[1] create');
  let r = await call('POST', '/admin/create', {
    body: { licenseId: 'yt-test', password: 'stop-pw', days: 10 },
    headers: { 'x-master-key': MASTER_KEY },
  });
  assert(r.status === 200 && r.data.ok === true, `create 成功（status=${r.status}）`);
  r = await call('POST', '/admin/create', {
    body: { licenseId: 'yt-test', password: 'x', days: 10 },
    headers: { 'x-master-key': 'wrong' },
  });
  assert(r.status === 401, 'create 错误 masterKey -> 401');

  console.log('[2] check（inactive）');
  r = await call('POST', '/check', { body: { licenseId: 'yt-test' }, headers: { 'x-license-key': API_KEY } });
  assert(r.status === 200 && r.data.allowed === false && r.data.status === 'inactive', `inactive check allowed=false（status=${r.data.status}）`);
  r = await call('POST', '/check', { body: { licenseId: 'yt-test' }, headers: { 'x-license-key': 'wrong' } });
  assert(r.status === 401, 'check 错误 apiKey -> 401');

  console.log('[3] activate（密码校验）');
  r = await call('POST', '/admin/activate', { body: { licenseId: 'yt-test', password: 'wrong', days: 10 } });
  assert(r.status === 403, 'activate 错误密码 -> 403');
  r = await call('POST', '/admin/activate', { body: { licenseId: 'yt-test', password: 'stop-pw', days: 10 } });
  assert(r.status === 200 && r.data.ok === true && r.data.status === 'trial', 'activate 正确密码 -> trial');
  r = await call('POST', '/check', { body: { licenseId: 'yt-test' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.allowed === true && r.data.status === 'trial', 'activate 后 check allowed=true');
  assert(typeof r.data.expiresAt === 'number' && r.data.expiresAt > Date.now(), 'expiresAt 为未来时间');

  console.log('[4] unlock / lock');
  r = await call('POST', '/admin/unlock', { body: { licenseId: 'yt-test', password: 'stop-pw' } });
  assert(r.status === 200 && r.data.status === 'active', 'unlock -> active');
  r = await call('POST', '/check', { body: { licenseId: 'yt-test' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.allowed === true && r.data.status === 'active' && r.data.expiresAt === undefined, 'unlock 后 check allowed=true 无到期');
  r = await call('POST', '/admin/lock', { body: { licenseId: 'yt-test', password: 'stop-pw' } });
  assert(r.status === 200 && r.data.status === 'locked', 'lock -> locked');
  r = await call('POST', '/check', { body: { licenseId: 'yt-test' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.allowed === false, 'lock 后 check allowed=false');

  console.log('[5] 爆破锁定（连续 5 次错误密码 -> 429）');
  // 先重新 activate 到 trial
  await call('POST', '/admin/activate', { body: { licenseId: 'yt-test', password: 'stop-pw', days: 10 } });
  let got429 = false;
  for (let i = 0; i < 6; i++) {
    r = await call('POST', '/admin/activate', { body: { licenseId: 'yt-test', password: 'wrong', days: 10 } });
    if (r.status === 429) { got429 = true; break; }
  }
  assert(got429, '连续错误密码触发 429 锁定');
  // 正确密码在锁定期内也应被拒
  r = await call('POST', '/admin/activate', { body: { licenseId: 'yt-test', password: 'stop-pw', days: 10 } });
  assert(r.status === 429, '锁定期内正确密码也被拒（429）');

  console.log('[6] status（运维查询）');
  r = await call('GET', '/admin/status?licenseId=yt-test', { headers: { 'x-master-key': MASTER_KEY } });
  assert(r.status === 200 && r.data.licenseId === 'yt-test', 'status 返回 license 详情');
  r = await call('GET', '/admin/status?licenseId=yt-test', { headers: { 'x-master-key': 'wrong' } });
  assert(r.status === 401, 'status 错误 masterKey -> 401');

  console.log('[7] 完整性哈希（篡改检测）');
  // 重新创建 license 用于完整性场景（前面的爆破锁定可能还在）
  await call('POST', '/admin/create', {
    body: { licenseId: 'yt-int', password: 'stop-pw', days: 10 },
    headers: { 'x-master-key': MASTER_KEY },
  });
  await call('POST', '/admin/activate', { body: { licenseId: 'yt-int', password: 'stop-pw', days: 10 } });
  // 首次 check 不带 hash：tampered 应为 false（视为未上报，不当作篡改）
  r = await call('POST', '/check', { body: { licenseId: 'yt-int' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.allowed === true && r.data.tampered === false, '首次 check 无 hash -> tampered=false');
  // 首次带 hash：记录基线，tampered=false
  r = await call('POST', '/check', { body: { licenseId: 'yt-int', integrityHash: 'hash-v1' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.tampered === false, '首次带 hash 记录基线 -> tampered=false');
  // 相同 hash 再来：仍 tampered=false
  r = await call('POST', '/check', { body: { licenseId: 'yt-int', integrityHash: 'hash-v1' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.tampered === false, '相同 hash -> tampered=false');
  // 不同 hash：tampered=true
  r = await call('POST', '/check', { body: { licenseId: 'yt-int', integrityHash: 'hash-v2-tampered' }, headers: { 'x-license-key': API_KEY } });
  assert(r.data.tampered === true, '不同 hash -> tampered=true');
  // status 暴露 tampered + tamperedSince + lastIntegrityHash
  r = await call('GET', '/admin/status?licenseId=yt-int', { headers: { 'x-master-key': MASTER_KEY } });
  assert(r.data.tampered === true && typeof r.data.tamperedSince === 'number', 'status 返回 tampered=true 与 tamperedSince');
  assert(r.data.lastIntegrityHash === 'hash-v2-tampered', 'status 返回 lastIntegrityHash（最新上报的 hash）');

  console.log(`\n==== Worker 测试结果：${passed} 通过 / ${failed} 失败 ====`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => { console.error('Worker 测试异常:', e); process.exit(1); });
