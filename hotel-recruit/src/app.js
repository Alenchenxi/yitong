// 酒店招聘报名服务：静态 H5 + 报名接口 + 访问埋点 + 飞书 Base 写入（零 npm 依赖）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { sendCode } = require('./sms');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);

// 本地运行时自动加载根目录 .env（docker 由 compose env_file 注入，不受影响）
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const recruitment = require(path.join(ROOT, 'config', 'hotels.json'));
const hotels = recruitment.hotels;
const inviters = require(path.join(ROOT, 'config', 'inviters.json')); // { 编码: 推广员姓名 }（手工配置）
const { APP_ID, APP_SECRET, BASE_TOKEN, TABLE_ID, ADMIN_TOKEN } = process.env;
const PORT = +(process.env.PORT || 8090);
const FEISHU_BASE_URL = `https://www.feishu.cn/base/${BASE_TOKEN}?table=${TABLE_ID}`; // 报表页「去飞书查看」入口
const NATURAL = '自然流量';

// 火山引擎短信（可选）：5 个 SMS_* 全部配置后才启用验证码校验，未配置时报名流程不受影响
const SMS_CONF = {
  accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
  secretKey: process.env.SMS_SECRET_KEY || '',
  account: process.env.SMS_ACCOUNT || '',
  sign: process.env.SMS_SIGN || '',
  templateId: process.env.SMS_TEMPLATE_ID || '',
};
const smsReady = Object.values(SMS_CONF).every(Boolean);

if (!APP_ID || !APP_SECRET || !BASE_TOKEN || !TABLE_ID || !ADMIN_TOKEN) {
  console.error('缺少环境变量，参考 .env.example 配置 .env');
  process.exit(1);
}

// ---------- 飞书 ----------
let tokenCache = { token: '', expireAt: 0 };
async function feishuToken() {
  if (tokenCache.token && Date.now() < tokenCache.expireAt) return tokenCache.token;
  const r = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  }).then(x => x.json());
  if (!r.tenant_access_token) throw new Error('获取飞书 token 失败: ' + JSON.stringify(r));
  tokenCache = { token: r.tenant_access_token, expireAt: Date.now() + (r.expire - 60) * 1000 };
  return tokenCache.token;
}

async function feishuAPI(apiPath, body, method = 'POST') {
  const token = await feishuToken();
  const r = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(x => x.json());
  if (r.code !== 0) throw new Error(`飞书接口 ${r.code}: ${r.msg}`);
  return r.data;
}

function cellText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(s => (typeof s === 'string' ? s : s.text || '')).join('');
  return String(v);
}

// 推广员自助注册：落盘 data/inviters-auto.json（挂载卷，重建不丢），与手工配置合并查询
const AUTO_INVITERS = path.join(DATA, 'inviters-auto.json');
let autoInviters = {};
try { autoInviters = JSON.parse(fs.readFileSync(AUTO_INVITERS, 'utf8')); } catch {}
function promoterName(code) {
  const v = autoInviters[code];
  if (v) return v.name;
  const m = inviters[code]; // 手工配置支持 "码":"姓名" 或 "码":{"name","phone"} 两种写法
  return m && typeof m === 'object' ? m.name : m;
}
function promoterPhone(code) {
  const v = autoInviters[code];
  if (v) return v.phone || '';
  const m = inviters[code];
  return m && typeof m === 'object' ? m.phone || '' : '';
}
function promoterSource(code) {
  if (autoInviters[code]) return '自助注册';
  if (inviters[code]) return '手工配置';
  if (deletedInviters[code]) return '已删除';
  return '';
}
function genCode() { // u + 4 位无易混字符，避开手工配置的 p 前缀段
  const ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (;;) {
    let c = 'u';
    for (let i = 0; i < 4; i++) c += ABC[Math.floor(Math.random() * ABC.length)];
    if (!inviters[c] && !autoInviters[c]) return c;
  }
}

// 写盘：内存名单为准。管理员删除请走 /api/promoter/del（内存+磁盘同步）；
// 若手动改文件删人，改完必须 docker compose restart，否则下次注册会把内存旧名单写回
function persistAutoInviters() {
  fs.writeFile(AUTO_INVITERS, JSON.stringify(autoInviters, null, 2), () => {});
}

// 回收站：删除的推广员先进 data/inviters-deleted.json，可恢复原码（老链接/海报直接复活）
const DELETED_INVITERS = path.join(DATA, 'inviters-deleted.json');
let deletedInviters = {};
try { deletedInviters = JSON.parse(fs.readFileSync(DELETED_INVITERS, 'utf8')); } catch {}
function persistDeletedInviters() {
  fs.writeFile(DELETED_INVITERS, JSON.stringify(deletedInviters, null, 2), () => {});
}

function codesOf(b) { // 兼容 {code} 单个与 {codes:[]} 批量
  return (Array.isArray(b.codes) ? b.codes : [b.code]).map(c => String(c || '').trim().slice(0, 16)).filter(Boolean);
}

// 管理员删除（支持批量）：移入回收站（手工配置的码在 config/inviters.json，不在本接口范围）
async function handlePromoterDel(req, res, url) {
  if (url.searchParams.get('token') !== ADMIN_TOKEN) return sendJSON(res, 401, { ok: false, msg: '无权限' });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
  const done = [], skip = [];
  for (const code of codesOf(b)) {
    if (!autoInviters[code]) { skip.push(code); continue; }
    deletedInviters[code] = { ...autoInviters[code], delTs: Date.now() };
    delete autoInviters[code];
    done.push(code);
  }
  if (done.length) { persistAutoInviters(); persistDeletedInviters(); }
  sendJSON(res, 200, { ok: true, done, skip });
}

// 从回收站恢复原码
async function handlePromoterRestore(req, res, url) {
  if (url.searchParams.get('token') !== ADMIN_TOKEN) return sendJSON(res, 401, { ok: false, msg: '无权限' });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
  const done = [], skip = [];
  for (const code of codesOf(b)) {
    const v = deletedInviters[code];
    if (!v || autoInviters[code]) { skip.push(code); continue; }
    autoInviters[code] = { name: v.name, phone: v.phone, ts: v.ts || Date.now() };
    delete deletedInviters[code];
    done.push(code);
  }
  if (done.length) { persistAutoInviters(); persistDeletedInviters(); }
  sendJSON(res, 200, { ok: true, done, skip });
}

// 彻底删除（不可恢复；飞书历史记录仍保留）
async function handlePromoterPurge(req, res, url) {
  if (url.searchParams.get('token') !== ADMIN_TOKEN) return sendJSON(res, 401, { ok: false, msg: '无权限' });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
  const done = [], skip = [];
  for (const code of codesOf(b)) {
    if (!deletedInviters[code]) { skip.push(code); continue; }
    delete deletedInviters[code];
    done.push(code);
  }
  if (done.length) persistDeletedInviters();
  sendJSON(res, 200, { ok: true, done, skip });
}

async function handlePromoter(req, res) {
  const ip = clientIP(req);
  if (rateLimited(ip, 3, 60e3)) return sendJSON(res, 429, { ok: false, msg: '提交太频繁，请稍后再试' });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { ok: false, msg: '参数错误' }); }
  const name = String(b.name || '').trim().slice(0, 20);
  const phone = String(b.phone || '').trim();
  if (name.length < 2) return sendJSON(res, 400, { ok: false, msg: '请填写真实姓名' });
  if (!/^1\d{10}$/.test(phone)) return sendJSON(res, 400, { ok: false, msg: '请填写正确的 11 位手机号' });
  rateHit(ip); // 校验通过才算一次，填错重试不占额度
  // 同手机号幂等：重复注册返回原码，码不会跟人走丢
  const exist = Object.keys(autoInviters).find(c => autoInviters[c].phone === phone);
  if (exist) return sendJSON(res, 200, { ok: true, code: exist, existed: true });
  const code = genCode();
  autoInviters[code] = { name, phone, ts: Date.now() };
  persistAutoInviters();
  sendJSON(res, 200, { ok: true, code });
}

async function createRecord(fields) {
  const d = await feishuAPI('/records', { fields });
  return d.record;
}

// 手机号查重：已报名返回 record_id，否则 null
async function findByPhone(phone) {
  const d = await feishuAPI('/records/search', {
    field_names: ['电话'],
    filter: { conjunction: 'and', conditions: [{ field_name: '电话', operator: 'is', value: [phone] }] },
    automatic_fields: false,
  });
  return d.items && d.items.length ? d.items[0].record_id : null;
}

// 短信验证码：内存存储（重启失效，重新发送即可），6 位 / 5 分钟有效 / 同号 60s 重发 / 每 IP 每分钟 1 条
const smsCodes = new Map(); // phone -> { code, exp, lastSent }
function smsCooldown(phone) {
  const v = smsCodes.get(phone);
  return v && Date.now() < v.lastSent + 60e3 ? Math.ceil((v.lastSent + 60e3 - Date.now()) / 1e3) : 0;
}

async function handleSmsSend(req, res) {
  const ip = clientIP(req);
  if (rateLimited(ip, 1, 60e3)) return sendJSON(res, 429, { ok: false, msg: '发送太频繁，请1分钟后再试' });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
  const phone = String(b.phone || '').trim();
  if (!/^1\d{10}$/.test(phone)) return sendJSON(res, 400, { ok: false, msg: '请先填写正确的 11 位手机号' });
  if (!smsReady) return sendJSON(res, 503, { ok: false, msg: '短信服务未配置' });
  const left = smsCooldown(phone);
  if (left) return sendJSON(res, 429, { ok: false, msg: `${left}s 后可重新发送` });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  try {
    await sendCode(SMS_CONF, phone, code);
  } catch (e) {
    console.error('[sms]', e.message);
    return sendJSON(res, 502, { ok: false, msg: '验证码发送失败，请稍后再试' });
  }
  rateHit(ip);
  smsCodes.set(phone, { code, exp: Date.now() + 5 * 60e3, lastSent: Date.now() });
  sendJSON(res, 200, { ok: true });
}

// ---------- 通用 ----------
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}
function sendJSON(res, code, obj) { send(res, code, JSON.stringify(obj)); }

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clientIP(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

// 简易内存限频：每 IP 每 windowMs 最多 max 次，默认 1 小时（重启清零，够用）。
// rateLimited 只查不记，请求成功后调 rateHit 记账——失败重试不占额度
const rateMap = new Map();
function rateLimited(ip, max, windowMs = 3600e3) {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter(t => t > now - windowMs);
  rateMap.set(ip, arr);
  return arr.length >= max;
}
function rateHit(ip) {
  const now = Date.now();
  const arr = rateMap.get(ip) || [];
  arr.push(now);
  rateMap.set(ip, arr);
}

function visitFile() {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return path.join(DATA, `visits-${ym}.jsonl`);
}

// ---------- 接口 ----------
async function handleApply(req, res) {
  const ip = clientIP(req);
  if (rateLimited(ip, 3, 60e3)) return sendJSON(res, 429, { ok: false, msg: '提交太频繁，请稍后再试' });
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { return sendJSON(res, 400, { ok: false, msg: '参数错误' }); }

  const name = String(b.name || '').trim().slice(0, 20);
  const gender = String(b.gender || '').trim();
  const phone = String(b.phone || '').trim();
  const school = String(b.school || '').trim().slice(0, 40);
  const birth = String(b.birth || '').trim().slice(0, 10);
  const hotel = String(b.hotel || '').trim().slice(0, 40);
  const rawInviter = String(b.inviter || '').trim().slice(0, 16);
  // 未勾选工作经验=无经验；勾选则必须给出合法时长（下拉二选一）
  const experience = b.experience && ['15天以上', '15天以下'].includes(b.experience) ? b.experience : '无经验';

  if (!name) return sendJSON(res, 400, { ok: false, msg: '请填写姓名' });
  if (gender !== '男' && gender !== '女') return sendJSON(res, 400, { ok: false, msg: '请选择性别' });
  if (!/^1\d{10}$/.test(phone)) return sendJSON(res, 400, { ok: false, msg: '手机号格式不正确' });
  if (!school) return sendJSON(res, 400, { ok: false, msg: '请填写学校' });
  if (!/^\d{4}[-/年]\d{1,2}([-/月]?)$/.test(birth)) return sendJSON(res, 400, { ok: false, msg: '出生年月格式不正确，如 2000-06' });
  const birthMatch = birth.match(/^(\d{4})[-/年](\d{1,2})/);
  if (+birthMatch[2] < 1 || +birthMatch[2] > 12) return sendJSON(res, 400, { ok: false, msg: '出生月份需在1至12月之间' });
  const minAge = +(recruitment.requirements && recruitment.requirements.minAge) || 16;
  const ageDate = new Date(recruitment.openDate || Date.now());
  const ageMonths = ageDate.getFullYear() * 12 + ageDate.getMonth() - (+birthMatch[1] * 12 + (+birthMatch[2] - 1));
  if (ageMonths < minAge * 12) return sendJSON(res, 400, { ok: false, msg: `报名者需在上岗时年满${minAge}周岁` });
  if (!hotels.some(h => h.name === hotel)) return sendJSON(res, 400, { ok: false, msg: '报名酒店无效，请返回重新报名' });

  // 短信服务已配置时强制校验验证码；校验放在读写飞书之前，失败不触达 Base
  if (smsReady) {
    const v = smsCodes.get(phone);
    if (!v || Date.now() > v.exp || String(b.smsCode || '').trim() !== v.code) {
      return sendJSON(res, 400, { ok: false, msg: '验证码错误或已过期，请重新获取' });
    }
  }

  const name0 = promoterName(rawInviter);
  const inviterCode = name0 ? rawInviter : '';
  const promoterDisplayName = name0 || NATURAL;

  let existId = null;
  try {
    // 同手机号=更新填写内容（酒店可换）；推广员归属保持首次提交，防止重复提交改归属；报名类型只在首次创建时标记
    existId = await findByPhone(phone);
    const fillFields = { 姓名: name, 性别: gender, 学校: school, 出生年月: birth, 报名酒店: hotel, 是否有酒店工作经验: experience };
    if (existId) {
      await feishuAPI(`/records/${existId}`, { fields: fillFields }, 'PUT');
    } else {
      await createRecord({ ...fillFields, 电话: phone, 推广员: promoterDisplayName, inviter编码: inviterCode, 报名类型: '新报名' });
    }
  } catch (e) {
    console.error('[apply]', e.message);
    return sendJSON(res, 502, { ok: false, msg: '提交失败，请稍后再试' });
  }
  rateHit(ip); // 写表成功才记账，失败/网络异常重试不占额度
  sendJSON(res, 200, { ok: true, updated: !!existId });
}

async function handleVisit(req, res) {
  const ip = clientIP(req);
  let b;
  try { b = JSON.parse(await readBody(req)); } catch { b = {}; }
  const raw = String(b.inviter || '').trim().slice(0, 16);
  const code = promoterName(raw) ? raw : '';
  const limited = rateLimited(`v:${ip}`, 60);
  if (!limited) {
    rateHit(`v:${ip}`);
    const line = JSON.stringify({ t: Date.now(), inviter: code, ip });
    fs.appendFile(visitFile(), line + '\n', () => {});
  }
  send(res, 204, '');
}

// 推广员自助查业绩：码 + 手机号（手机号未登记的手工码仅凭码查询）
async function handleMy(req, res, url) {
  const code = (url.searchParams.get('code') || '').trim().slice(0, 16);
  const phone = (url.searchParams.get('phone') || '').trim();
  const mip = 'm:' + clientIP(req);
  if (rateLimited(mip, 30)) return sendJSON(res, 429, { ok: false, msg: '查询太频繁，请稍后再试' });
  rateHit(mip);
  const name = promoterName(code);
  if (!name) return sendJSON(res, 200, { ok: false, msg: '推广码不存在，请核对后重试' });
  const onFile = promoterPhone(code);
  if (onFile && phone !== onFile) return sendJSON(res, 200, { ok: false, msg: '手机号与注册信息不一致' });

  // 报名数：飞书按 inviter编码 过滤计数
  let applies = 0; let pageToken = '';
  do {
    const d = await feishuAPI('/records/search?page_size=500' + (pageToken ? `&page_token=${pageToken}` : ''), {
      field_names: ['inviter编码'], automatic_fields: false,
      filter: { conjunction: 'and', conditions: [{ field_name: 'inviter编码', operator: 'is', value: [code] }] },
    });
    applies += (d.items || []).length;
    pageToken = d.has_more ? d.page_token : '';
  } while (pageToken);

  // 访问数：汇总所有月度 jsonl
  let visits = 0;
  for (const f of fs.readdirSync(DATA)) {
    if (!f.startsWith('visits-')) continue;
    for (const line of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { if (JSON.parse(line).inviter === code) visits++; } catch {}
    }
  }
  sendJSON(res, 200, { ok: true, name, visits, applies, rate: visits ? +(applies / visits * 100).toFixed(1) + '%' : '-' });
}

async function handleStats(req, res, url) {
  if (url.searchParams.get('token') !== ADMIN_TOKEN) return sendJSON(res, 401, { ok: false, msg: '无权限' });
  // 报名数：飞书记录按 inviter编码 分组
  const applies = {}; const phones = new Set();
  let pageToken = '';
  do {
    const d = await feishuAPI('/records/search?page_size=500' + (pageToken ? `&page_token=${pageToken}` : ''), {
      field_names: ['inviter编码', '电话'], automatic_fields: false,
    });
    for (const item of d.items || []) {
      const code = cellText(item.fields['inviter编码']);
      applies[code] = (applies[code] || 0) + 1;
      const ph = cellText(item.fields['电话']); if (ph) phones.add(ph);
    }
    pageToken = d.has_more ? d.page_token : '';
  } while (pageToken);

  // 访问数：汇总所有月度 jsonl
  const visits = {};
  for (const f of fs.readdirSync(DATA)) {
    if (!f.startsWith('visits-')) continue;
    for (const line of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const o = JSON.parse(line); visits[o.inviter || ''] = (visits[o.inviter || ''] || 0) + 1; } catch {}
    }
  }

  const codes = new Set([...Object.keys(inviters), ...Object.keys(autoInviters), ...Object.keys(applies), ...Object.keys(visits)]);
  const rows = [...codes].map(code => {
    const name = promoterName(code) || (code ? `未知编码:${code}` : NATURAL);
    const v = visits[code] || 0; const a = applies[code] || 0;
    return { code: code || '-', name, phone: promoterPhone(code), source: promoterSource(code), visits: v, applies: a, rate: v ? +(a / v * 100).toFixed(1) + '%' : '-' };
  }).sort((x, y) => y.applies - x.applies);
  sendJSON(res, 200, { ok: true, totalPhones: phones.size, rows, trash: deletedInviters, base: FEISHU_BASE_URL });
}

// 某推广员的报名明细（报表弹层用）：飞书按 inviter编码 过滤
async function handleApplies(req, res, url) {
  if (url.searchParams.get('token') !== ADMIN_TOKEN) return sendJSON(res, 401, { ok: false, msg: '无权限' });
  const code = (url.searchParams.get('code') || '').trim().slice(0, 16);
  if (!code) return sendJSON(res, 400, { ok: false, msg: '缺少推广码' });
  const items = []; let pageToken = '';
  do {
    const d = await feishuAPI('/records/search?page_size=500' + (pageToken ? `&page_token=${pageToken}` : ''), {
      field_names: ['姓名', '性别', '学校', '报名酒店', '电话'], automatic_fields: false,
      filter: { conjunction: 'and', conditions: [{ field_name: 'inviter编码', operator: 'is', value: [code] }] },
    });
    for (const it of d.items || []) {
      const f = it.fields;
      items.push({ name: cellText(f['姓名']), gender: cellText(f['性别']), school: cellText(f['学校']), hotel: cellText(f['报名酒店']), phone: cellText(f['电话']) });
    }
    pageToken = d.has_more ? d.page_token : '';
  } while (pageToken);
  sendJSON(res, 200, { ok: true, code, items });
}

// 各酒店报名人数（首页从众展示用）：飞书按「报名酒店」分组计数，内存缓存 5 分钟
let countsCache = { data: null, at: 0 };
async function handleCounts(req, res) {
  if (countsCache.data && Date.now() - countsCache.at < 300e3) return sendJSON(res, 200, countsCache.data);
  const byHotel = {}; let total = 0; let pageToken = '';
  do {
    const d = await feishuAPI('/records/search?page_size=500' + (pageToken ? `&page_token=${pageToken}` : ''), {
      field_names: ['报名酒店'], automatic_fields: false,
    });
    for (const item of d.items || []) {
      const h = cellText(item.fields['报名酒店']);
      if (!h) continue;
      byHotel[h] = (byHotel[h] || 0) + 1;
      total++;
    }
    pageToken = d.has_more ? d.page_token : '';
  } while (pageToken);
  countsCache = { data: { ok: true, total, byHotel }, at: Date.now() };
  sendJSON(res, 200, countsCache.data);
}

// ---------- 静态文件 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(res, urlPath) {
  try { urlPath = decodeURIComponent(urlPath); } catch { return send(res, 400, 'bad path', 'text/plain'); } // 中文文件名
  let p = path.normalize(path.join(PUBLIC, urlPath === '/' ? 'index.html' : urlPath));
  if (!p.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(PUBLIC, 'index.html');
  send(res, 200, fs.readFileSync(p), MIME[path.extname(p)] || 'application/octet-stream');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/apply' && req.method === 'POST') return await handleApply(req, res);
    if (url.pathname === '/api/sms/send' && req.method === 'POST') return await handleSmsSend(req, res);
    if (url.pathname === '/api/visit' && req.method === 'POST') return await handleVisit(req, res);
    if (url.pathname === '/api/stats' && req.method === 'GET') return await handleStats(req, res, url);
    if (url.pathname === '/api/my' && req.method === 'GET') return await handleMy(req, res, url);
    if (url.pathname === '/api/applies' && req.method === 'GET') return await handleApplies(req, res, url);
    if (url.pathname === '/api/config' && req.method === 'GET') return sendJSON(res, 200, { ok: true, ...recruitment });
    if (url.pathname === '/api/counts' && req.method === 'GET') return await handleCounts(req, res);
    if (url.pathname === '/api/promoter' && req.method === 'POST') return await handlePromoter(req, res);
    if (url.pathname === '/api/promoter/del' && req.method === 'POST') return await handlePromoterDel(req, res, url);
    if (url.pathname === '/api/promoter/restore' && req.method === 'POST') return await handlePromoterRestore(req, res, url);
    if (url.pathname === '/api/promoter/purge' && req.method === 'POST') return await handlePromoterPurge(req, res, url);
    if (req.method === 'GET') return serveStatic(res, url.pathname);
    send(res, 404, 'not found', 'text/plain');
  } catch (e) {
    console.error('[server]', e.message);
    sendJSON(res, 500, { ok: false, msg: '服务器开小差了，请稍后再试' });
  }
});
server.listen(PORT, () => console.log(`hotel-recruit listening on :${PORT}`));
