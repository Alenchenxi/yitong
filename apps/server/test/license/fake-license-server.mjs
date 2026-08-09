// 测试用假授权服务器（契约与 infra/license-server/worker.js 一致；内存态、明文密码，仅测试用）
//
// 启动：
//   LICENSE_API_KEY=test-api-key LICENSE_MASTER_KEY=test-master-key FAKE_LICENSE_PORT=4999 \
//     node apps/server/test/license/fake-license-server.mjs
// 测试专用端点（不走鉴权）：
//   POST /test/reset            清空所有 license
//   POST /test/expire {licenseId} 把 trial 的 activatedAt 拨到已过期
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_LICENSE_PORT) || 4999;
const API_KEY = process.env.LICENSE_API_KEY || 'test-api-key';
const MASTER_KEY = process.env.LICENSE_MASTER_KEY || 'test-master-key';
const DAY_MS = 86_400_000;

const store = new Map(); // licenseId -> { password, status, activatedAt, durationMs }

const json = (res, data, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => {
      try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); }
    });
  });

function compute(lic, now) {
  if (!lic) return { allowed: false, status: 'unknown' };
  if (lic.status === 'active') return { allowed: true, status: 'active' };
  if (lic.status === 'trial') {
    const expiresAt = lic.activatedAt + lic.durationMs;
    return { allowed: now < expiresAt, status: 'trial', expiresAt };
  }
  return { allowed: false, status: lic.status };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  const method = req.method.toUpperCase();
  try {
    if (method === 'GET' && pathname === '/') return json(res, { ok: true, service: 'fake-license' });

    if (method === 'POST' && pathname === '/check') {
      if (req.headers['x-license-key'] !== API_KEY) return json(res, { error: 'unauthorized' }, 401);
      const body = await readBody(req);
      return json(res, { ...compute(store.get(body.licenseId), Date.now()), serverTime: Date.now() });
    }

    // 测试专用
    if (method === 'POST' && pathname === '/test/reset') { store.clear(); return json(res, { ok: true }); }
    if (method === 'POST' && pathname === '/test/expire') {
      const body = await readBody(req);
      const lic = store.get(body.licenseId);
      if (lic) lic.activatedAt = Date.now() - lic.durationMs - 1000; // 拨到已过期
      return json(res, { ok: true });
    }

    if (!pathname.startsWith('/admin/')) return json(res, { error: 'not found' }, 404);

    const isMaster = req.headers['x-master-key'] === MASTER_KEY;
    if (method === 'POST' && pathname === '/admin/create') {
      if (!isMaster) return json(res, { error: 'unauthorized' }, 401);
      const body = await readBody(req);
      store.set(body.licenseId, {
        password: body.password,
        status: 'inactive',
        activatedAt: Date.now(),
        durationMs: (Number(body.days) > 0 ? Number(body.days) : 10) * DAY_MS,
      });
      return json(res, { ok: true, licenseId: body.licenseId, status: 'inactive' });
    }
    if (method === 'GET' && pathname === '/admin/status') {
      if (!isMaster) return json(res, { error: 'unauthorized' }, 401);
      const id = url.searchParams.get('licenseId') || '';
      const lic = store.get(id);
      if (!lic) return json(res, { error: 'not found' }, 404);
      return json(res, { id, ...compute(lic, Date.now()) });
    }
    const pwdRoutes = ['/admin/activate', '/admin/unlock', '/admin/lock'];
    if (method === 'POST' && pwdRoutes.includes(pathname)) {
      const body = await readBody(req);
      const lic = store.get(body.licenseId);
      if (!lic) return json(res, { error: 'license not found' }, 404);
      if (lic.password !== body.password) return json(res, { error: 'invalid password' }, 403);
      const now = Date.now();
      if (pathname === '/admin/activate') {
        lic.status = 'trial';
        lic.activatedAt = now;
        lic.durationMs = (Number(body.days) > 0 ? Number(body.days) : 10) * DAY_MS;
      } else if (pathname === '/admin/unlock') {
        lic.status = 'active';
      } else {
        lic.status = 'locked';
      }
      return json(res, { ok: true, licenseId: body.licenseId, ...compute(lic, now) });
    }
    return json(res, { error: 'not found' }, 404);
  } catch (e) {
    return json(res, { error: String(e) }, 500);
  }
});

server.listen(PORT, () => console.log(`fake-license on :${PORT}`));
