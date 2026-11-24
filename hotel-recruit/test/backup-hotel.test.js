const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

// 把 src/ 和 config/ 拷到临时目录再起服务：不读本地 .env（里面有真实飞书与短信配置），也不写仓库的 data/。
// 飞书请求由 tools/feishu-stub.js 接管，每次调用按顺序记进临时日志
async function startServer(t, stub = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hotel-recruit-'));
  for (const d of ['src', 'config']) { // 逐文件拷贝：Windows 上 cpSync 递归拷目录会让进程异常退出
    fs.mkdirSync(path.join(dir, d));
    for (const f of fs.readdirSync(path.join(__dirname, '..', d))) fs.copyFileSync(path.join(__dirname, '..', d, f), path.join(dir, d, f));
  }
  const log = path.join(dir, 'feishu.jsonl');
  const port = 18090 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['--require', path.join(__dirname, '..', 'tools', 'feishu-stub.js'), path.join(dir, 'src', 'app.js')], {
    env: { ...process.env, PORT: String(port), APP_ID: 'stub', APP_SECRET: 'stub', BASE_TOKEN: 'stub', TABLE_ID: 'stub', ADMIN_TOKEN: 'stub', STUB_LOG: log, ...stub },
    stdio: 'ignore',
  });
  t.after(async () => { await new Promise(r => { child.once('exit', r); child.kill(); }); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }); // 等进程退出再删，否则 Windows 上删不干净
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try { await (await fetch(base + '/api/config')).json(); break; } catch (e) { if (i > 50) throw e; await new Promise(r => setTimeout(r, 100)); }
  }
  const apply = (extra) => fetch(base + '/api/apply', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '测试', gender: '男', phone: '13800000000', school: '测试学校', birth: '2000-06', hotel: '华美达酒店', ...extra }),
  }).then(r => r.json());
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  return {
    apply,
    flow: () => calls().filter(c => c.p !== '/records/search').map(c => c.m + ' ' + c.p), // 除手机号查重外的飞书调用顺序
    writes: () => calls().filter(c => c.b.fields).map(c => c.b.fields), // 记录写入及其字段
    createdFields: () => calls().filter(c => c.m === 'POST' && c.p === '/fields').map(c => c.b), // 建列请求体
  };
}
const BASE_FIELDS = { 姓名: '测试', 性别: '男', 学校: '测试学校', 出生年月: '2000-06', 报名酒店: '华美达酒店', 是否有酒店工作经验: '无经验' };
const NEW_FIELDS = { ...BASE_FIELDS, 电话: '13800000000', 推广员: '自然流量', inviter编码: '', 报名类型: '新报名' };

test('带备选的新报名：列已存在时不建列，备选与报名信息一次写入', async (t) => {
  const s = await startServer(t, { STUB_FIELD_EXISTS: '1' });
  assert.deepEqual(await s.apply({ backupHotel: '繁城大酒店' }), { ok: true, updated: false });
  assert.deepEqual(s.flow(), ['GET /fields', 'POST /records']);
  assert.deepEqual(s.writes(), [{ ...NEW_FIELDS, 备选酒店: '繁城大酒店' }]);
});

test('带备选的新报名：列不存在时先建文本列，再一次写入', async (t) => {
  const s = await startServer(t, { STUB_FIELD_EXISTS: '0' });
  assert.equal((await s.apply({ backupHotel: '繁城大酒店' })).ok, true);
  assert.deepEqual(s.flow(), ['GET /fields', 'POST /fields', 'POST /records']);
  assert.deepEqual(s.createdFields(), [{ field_name: '备选酒店', type: 1 }]);
  assert.deepEqual(s.writes(), [{ ...NEW_FIELDS, 备选酒店: '繁城大酒店' }]);
});

test('不带备选的新报名：不查列不建列，写入内容与改动前一致', async (t) => {
  const s = await startServer(t, { STUB_FIELD_EXISTS: '0' });
  assert.equal((await s.apply({})).ok, true);
  assert.deepEqual(s.flow(), ['POST /records']);
  assert.deepEqual(s.writes(), [NEW_FIELDS]);
});

test('重复提交未填备选：列已存在时在同一次更新里清空', async (t) => {
  const s = await startServer(t, { STUB_EXISTING: '1', STUB_FIELD_EXISTS: '1' });
  assert.deepEqual(await s.apply({}), { ok: true, updated: true });
  assert.deepEqual(s.flow(), ['GET /fields', 'PUT /records/recA']);
  assert.deepEqual(s.writes(), [{ ...BASE_FIELDS, 备选酒店: '' }]);
});

test('重复提交未填备选：列不存在时不会为了清空而建列', async (t) => {
  const s = await startServer(t, { STUB_EXISTING: '1', STUB_FIELD_EXISTS: '0' });
  assert.equal((await s.apply({})).ok, true);
  assert.deepEqual(s.flow(), ['GET /fields', 'PUT /records/recA']);
  assert.deepEqual(s.writes(), [BASE_FIELDS]);
});

test('建列失败（如缺少权限）：报名仍成功，只是不带备选', async (t) => {
  const s = await startServer(t, { STUB_FIELD_EXISTS: '0', STUB_FAIL_FIELDS: '1' });
  assert.equal((await s.apply({ backupHotel: '繁城大酒店' })).ok, true);
  assert.deepEqual(s.flow(), ['GET /fields', 'POST /fields', 'POST /records']);
  assert.deepEqual(s.writes(), [NEW_FIELDS]);
});

test('带备选的写入因列被删而失败后，下次提交重新确认并补建列', async (t) => {
  const s = await startServer(t, { STUB_FIELD_EXISTS: '1', STUB_DROP_FIELD: '1' });
  assert.equal((await s.apply({ backupHotel: '繁城大酒店' })).ok, false);
  assert.equal((await s.apply({ backupHotel: '繁城大酒店' })).ok, true);
  assert.deepEqual(s.flow(), ['GET /fields', 'POST /records', 'GET /fields', 'POST /fields', 'POST /records']);
  assert.deepEqual(s.writes().pop(), { ...NEW_FIELDS, 备选酒店: '繁城大酒店' });
});

test('备选与报名酒店相同或不存在：拒绝且不触达飞书记录', async (t) => {
  const s = await startServer(t, { STUB_FIELD_EXISTS: '1' });
  for (const bad of ['华美达酒店', '不存在酒店']) {
    const r = await s.apply({ backupHotel: bad });
    assert.equal(r.ok, false);
    assert.match(r.msg, /备选酒店/);
  }
  assert.deepEqual(s.writes(), []);
  assert.deepEqual(s.flow(), []); // 校验在查列之前
});
