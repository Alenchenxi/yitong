/**
 * 燚桐试用授权锁 - 远程授权服务器（Cloudflare Worker + Workers KV）
 *
 * 职责：持有 licenseId + 密码哈希(PBKDF2) + 倒计时状态，作为 phone-home 的唯一事实源。
 *   - POST /check            (X-License-Key)   读：是否放行 + 倒计时到期时间
 *   - POST /admin/create     (X-Master-Key)    注册新 license（bcrypt 类哈希、status=inactive）
 *   - POST /admin/activate   (password)        开启/重置 trial 倒计时
 *   - POST /admin/unlock     (password)        永久激活（停止倒计时）
 *   - POST /admin/lock       (password)        手动停服
 *   - GET  /admin/status     (X-Master-Key)    查 license 详情（运维）
 *
 * 密码用 WebCrypto PBKDF2-SHA256（10 万次）哈希，只存 KV；客户端 CLI 交互输入、HTTPS 传输、不落盘。
 * 环境变量（wrangler secret）：LICENSE_API_KEY（/check 共享密钥）、LICENSE_MASTER_KEY（运维主密钥）。
 * KV 绑定：LICENSE_KV。key 规约：license:<licenseId> / fails:<licenseId> / lock:<licenseId>。
 */

const PBKDF2_ITERATIONS = 100_000;
const DAY_MS = 86_400_000;
const LOCK_THRESHOLD = 5; // 连续 5 次密码错误 -> 锁 15 分钟
const LOCK_TTL = 900; // 秒

const enc = new TextEncoder();

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// ---------- PBKDF2 哈希 ----------
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = Number(parts[1]);
  const salt = unb64(parts[2]);
  const expected = unb64(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---------- 业务计算 ----------
function computeAllowed(lic, now) {
  if (!lic) return { allowed: false, status: 'unknown' };
  if (lic.status === 'active') return { allowed: true, status: 'active' };
  if (lic.status === 'trial') {
    const expiresAt = lic.activatedAt + lic.durationMs;
    return { allowed: now < expiresAt, status: 'trial', expiresAt };
  }
  return { allowed: false, status: lic.status }; // inactive | locked
}

function trialExpiresAt(lic) {
  return lic.status === 'trial' ? lic.activatedAt + lic.durationMs : undefined;
}

// ---------- 密码错误锁定（防在线爆破；client 持有 licenseId+apiKey，需防其猜密码）----------
async function isLocked(kv, licenseId) {
  return (await kv.get(`lock:${licenseId}`)) !== null;
}

async function registerFailure(kv, licenseId) {
  const raw = await kv.get(`fails:${licenseId}`);
  const fails = raw ? JSON.parse(raw) : { count: 0, firstAt: Date.now() };
  fails.count += 1;
  if (fails.count >= LOCK_THRESHOLD) {
    await kv.put(`lock:${licenseId}`, '1', { expirationTtl: LOCK_TTL });
    await kv.delete(`fails:${licenseId}`);
    return true;
  }
  await kv.put(`fails:${licenseId}`, JSON.stringify(fails), { expirationTtl: LOCK_TTL });
  return false;
}

async function clearFailures(kv, licenseId) {
  await kv.delete(`fails:${licenseId}`);
  await kv.delete(`lock:${licenseId}`);
}

// ---------- 路由 ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();
    const kv = env.LICENSE_KV;

    if (method === 'GET' && pathname === '/') {
      return json({ ok: true, service: 'yitong-license' });
    }

    // POST /check —— 客户端巡检（apiKey 鉴权）
    if (method === 'POST' && pathname === '/check') {
      if (request.headers.get('x-license-key') !== env.LICENSE_API_KEY) {
        return json({ error: 'unauthorized' }, 401);
      }
      const body = await readBody(request);
      const licenseId = String(body.licenseId || '');
      if (!licenseId) return json({ error: 'licenseId required' }, 400);
      const raw = await kv.get(`license:${licenseId}`);
      const lic = raw ? JSON.parse(raw) : null;
      const now = Date.now();
      return json({ ...computeAllowed(lic, now), serverTime: now });
    }

    if (!pathname.startsWith('/admin/')) {
      return json({ error: 'not found' }, 404);
    }

    const isMaster = request.headers.get('x-master-key') === env.LICENSE_MASTER_KEY;

    // POST /admin/create —— 注册 license（masterKey）
    if (method === 'POST' && pathname === '/admin/create') {
      if (!isMaster) return json({ error: 'unauthorized' }, 401);
      const body = await readBody(request);
      const licenseId = String(body.licenseId || '');
      const password = String(body.password || '');
      const days = Number(body.days) > 0 ? Number(body.days) : 10;
      if (!licenseId || !password) return json({ error: 'licenseId and password required' }, 400);
      if (await kv.get(`license:${licenseId}`)) {
        return json({ error: 'license already exists' }, 409);
      }
      const now = Date.now();
      const lic = {
        passwordHash: await hashPassword(password),
        status: 'inactive',
        activatedAt: now,
        durationMs: days * DAY_MS,
        updatedAt: now,
      };
      await kv.put(`license:${licenseId}`, JSON.stringify(lic));
      return json({ ok: true, licenseId, status: lic.status, durationDays: days });
    }

    // GET /admin/status —— 运维查询（masterKey）
    if (method === 'GET' && pathname === '/admin/status') {
      if (!isMaster) return json({ error: 'unauthorized' }, 401);
      const licenseId = String(url.searchParams.get('licenseId') || '');
      if (!licenseId) return json({ error: 'licenseId required' }, 400);
      const raw = await kv.get(`license:${licenseId}`);
      if (!raw) return json({ error: 'license not found' }, 404);
      const lic = JSON.parse(raw);
      const now = Date.now();
      return json({
        licenseId,
        ...computeAllowed(lic, now),
        expiresAt: trialExpiresAt(lic),
        updatedAt: lic.updatedAt,
      });
    }

    // 密码鉴权路由：activate / unlock / lock
    const passwordRoutes = ['/admin/activate', '/admin/unlock', '/admin/lock'];
    if (method === 'POST' && passwordRoutes.includes(pathname)) {
      const body = await readBody(request);
      const licenseId = String(body.licenseId || '');
      const password = String(body.password || '');
      if (!licenseId || !password) return json({ error: 'licenseId and password required' }, 400);

      if (await isLocked(kv, licenseId)) {
        return json({ error: 'too many failed attempts, try later' }, 429);
      }
      const raw = await kv.get(`license:${licenseId}`);
      if (!raw) {
        await registerFailure(kv, licenseId);
        return json({ error: 'license not found or invalid password' }, 404);
      }
      const lic = JSON.parse(raw);
      if (!(await verifyPassword(password, lic.passwordHash))) {
        const locked = await registerFailure(kv, licenseId);
        return json(
          { error: locked ? 'too many failed attempts, try later' : 'invalid password' },
          locked ? 429 : 403,
        );
      }

      await clearFailures(kv, licenseId);
      const now = Date.now();
      if (pathname === '/admin/activate') {
        const days = Number(body.days) > 0 ? Number(body.days) : 10;
        lic.status = 'trial';
        lic.activatedAt = now;
        lic.durationMs = days * DAY_MS;
      } else if (pathname === '/admin/unlock') {
        lic.status = 'active';
      } else {
        lic.status = 'locked';
      }
      lic.updatedAt = now;
      await kv.put(`license:${licenseId}`, JSON.stringify(lic));
      return json({
        ok: true,
        licenseId,
        ...computeAllowed(lic, now),
        expiresAt: trialExpiresAt(lic),
      });
    }

    return json({ error: 'not found' }, 404);
  },
};
