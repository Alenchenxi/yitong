// 测试专用预加载（node --require）：把对飞书的请求换成可控桩，并按顺序记录调用。
// 本地没有飞书凭证，也绝不能打到真实表格；场景由 STUB_* 环境变量控制
const fs = require('fs');
const LOG = process.env.STUB_LOG;
let fieldExists = process.env.STUB_FIELD_EXISTS === '1';
let dropField = process.env.STUB_DROP_FIELD === '1'; // 首次带备选写入时模拟「列被删」，用于验证自愈
const reply = (code, data) => ({ json: async () => ({ code, msg: code ? 'stub error' : 'Success', data }) });

global.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  const body = opts.body ? JSON.parse(opts.body) : {};
  const p = String(url).replace(/^.*\/tables\/[^/]+/, '').split('?')[0];
  if (String(url).includes('tenant_access_token')) return { json: async () => ({ tenant_access_token: 'stub', expire: 7200 }) };
  fs.appendFileSync(LOG, JSON.stringify({ m: method, p, b: body }) + '\n');
  if (method === 'GET' && p === '/fields') {
    return reply(0, { has_more: false, items: fieldExists ? [{ field_name: '电话' }, { field_name: '备选酒店' }] : [{ field_name: '电话' }] });
  }
  if (method === 'POST' && p === '/fields') {
    if (process.env.STUB_FAIL_FIELDS) return reply(99991672, {}); // 应用缺少新增字段权限
    fieldExists = true;
    return reply(0, { field: { field_id: 'fldB' } });
  }
  if (method === 'POST' && p === '/records/search') return reply(0, { has_more: false, items: process.env.STUB_EXISTING ? [{ record_id: 'recA' }] : [] });
  if (dropField && '备选酒店' in (body.fields || {})) { dropField = false; fieldExists = false; return reply(1254045, {}); } // FieldNameNotFound
  if (method === 'POST' && p === '/records') return reply(0, { record: { record_id: 'recNEW' } });
  if (method === 'PUT') return reply(0, { record: {} });
  return reply(1254045, {});
};
