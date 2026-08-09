/* eslint-disable no-console */
// 试用授权锁 冒烟测试（自包含：内联假授权服务器 + LicenseService/Guard 逻辑 + CLI）
// 运行：先 `pnpm --filter @yitong/server build`（CLI 测试需 dist/），再
//   `pnpm --filter @yitong/server exec ts-node test/license/license.smoke.ts`
// 不依赖数据库 / Nest 引导 / docker。失败时进程退出码 1。
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext, Reflector } from '@nestjs/common';
import { LicenseService } from '../../src/license/license.service';
import { LicenseGuard } from '../../src/license/license.guard';
import { LICENSE_DISABLED_CODE } from '../../src/license/license.constants';
import { BizException } from '../../src/common/exceptions/biz.exception';

const PORT = 4999;
const API_KEY = 'test-api-key';
const MASTER_KEY = 'test-master-key';
const LICENSE_ID = 'yt-smoke';
const PASSWORD = 'stop-pw';
const DAY_MS = 86_400_000;

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}
function assertThrows(fn: () => unknown, msg: string, check?: (e: unknown) => boolean): void {
  try { fn(); assert(false, `${msg}（未抛异常）`); }
  catch (e) {
    const ok = check ? check(e) : true;
    assert(ok, `${msg}（抛 ${e instanceof BizException ? `bizCode=${e.bizCode}` : (e as Error).message}）`);
  }
}

// ---------- 内联假授权服务器（契约同 infra/license-server/worker.js）----------
interface FakeLicense { password: string; status: string; activatedAt: number; durationMs: number; }
const store = new Map<string, FakeLicense>();
function compute(lic: FakeLicense | undefined, now: number) {
  if (!lic) return { allowed: false, status: 'unknown' };
  if (lic.status === 'active') return { allowed: true, status: 'active' };
  if (lic.status === 'trial') return { allowed: now < lic.activatedAt + lic.durationMs, status: 'trial', expiresAt: lic.activatedAt + lic.durationMs };
  return { allowed: false, status: lic.status };
}
function startFake(): Promise<Server> {
  return new Promise((resolve) => {
    const s = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${PORT}`);
      const m = req.method?.toUpperCase();
      const body = await new Promise<Record<string, unknown>>((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });
      const json = (data: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
      if (m === 'GET' && url.pathname === '/') return json({ ok: true });
      if (m === 'POST' && url.pathname === '/check') {
        if (req.headers['x-license-key'] !== API_KEY) return json({ error: 'unauthorized' }, 401);
        return json({ ...compute(store.get(String(body.licenseId)), Date.now()), serverTime: Date.now() });
      }
      if (m === 'POST' && url.pathname === '/test/reset') { store.clear(); return json({ ok: true }); }
      if (m === 'POST' && url.pathname === '/test/expire') {
        const lic = store.get(String(body.licenseId)); if (lic) lic.activatedAt = Date.now() - lic.durationMs - 1000;
        return json({ ok: true });
      }
      if (m === 'POST' && url.pathname === '/admin/create') {
        if (req.headers['x-master-key'] !== MASTER_KEY) return json({ error: 'unauthorized' }, 401);
        store.set(String(body.licenseId), { password: String(body.password), status: 'inactive', activatedAt: Date.now(), durationMs: (Number(body.days) > 0 ? Number(body.days) : 10) * DAY_MS });
        return json({ ok: true, status: 'inactive' });
      }
      if (['/admin/activate', '/admin/unlock', '/admin/lock'].includes(url.pathname || '') && m === 'POST') {
        const lic = store.get(String(body.licenseId));
        if (!lic) return json({ error: 'license not found' }, 404);
        if (lic.password !== body.password) return json({ error: 'invalid password' }, 403);
        if (url.pathname === '/admin/activate') { lic.status = 'trial'; lic.activatedAt = Date.now(); lic.durationMs = (Number(body.days) > 0 ? Number(body.days) : 10) * DAY_MS; }
        else if (url.pathname === '/admin/unlock') lic.status = 'active';
        else lic.status = 'locked';
        return json({ ok: true, ...compute(lic, Date.now()) });
      }
      return json({ error: 'not found' }, 404);
    });
    s.listen(PORT, () => resolve(s));
  });
}

async function fetchJson(input: string, init?: RequestInit & { headers?: Record<string, string> }): Promise<{ status: number; data: any }> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function makeConfig(vars: Record<string, string>): ConfigService {
  return { get: <T>(key: string) => vars[key] as unknown as T } as unknown as ConfigService;
}
function makeGuard(service: LicenseService, isPublic: boolean): LicenseGuard {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  return new LicenseGuard(service, reflector);
}
const mockCtx = { getHandler: () => () => {}, getClass: () => class {}, switchToHttp: () => ({ getRequest: () => ({}) }) } as unknown as ExecutionContext;

function runCli(args: string[], env: Record<string, string>): Promise<{ code: number; out: string; err: string }> {
  const cliPath = path.resolve(__dirname, '../../dist/license/license-cli.js');
  return new Promise((resolve) => {
    const p = spawn('node', [cliPath, ...args], { env: { ...process.env, ...env } });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (code) => resolve({ code: code ?? -1, out, err }));
  });
}

async function main(): Promise<void> {
  const fake = await startFake();
  try {
    // 注册 license（inactive）
    await fetchJson(`http://localhost:${PORT}/test/reset`, { method: 'POST' });
    await fetchJson(`http://localhost:${PORT}/admin/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-master-key': MASTER_KEY },
      body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD, days: 10 }),
    });

    const cfgVars = {
      LICENSE_SERVER_URL: `http://localhost:${PORT}`,
      LICENSE_ID: LICENSE_ID,
      LICENSE_API_KEY: API_KEY,
      LICENSE_TOLERANCE_HOURS: '2',
    };

    // === 1. 未配置（dev 放行）===
    console.log('[1] 未配置授权 -> dev 放行');
    {
      const svc = new LicenseService(makeConfig({}));
      assert(svc.isConfigured() === false, 'isConfigured=false');
      assert(svc.isAllowed() === true, '未配置时 isAllowed=true（dev 放行）');
    }

    // === 2. 配置后 inactive -> 不放行（fail-closed：尚未成功 check）===
    console.log('[2] 配置后 inactive -> 锁定');
    {
      const svc = new LicenseService(makeConfig(cfgVars));
      assert(svc.isConfigured() === true, 'isConfigured=true');
      assert(svc.isAllowed() === false, '首次 check 前 isAllowed=false（fail-closed）');
      const reached = await svc.refresh();
      assert(reached === true, 'refresh 成功到达授权服务器');
      assert(svc.isAllowed() === false, 'inactive 时 isAllowed=false');
      const st = svc.getStatus();
      assert(st.status === 'inactive' && st.allowed === false, `getStatus status=${st.status}`);

      // === 3. Guard：不放行时抛 90003；@LicensePublic 放行 ===
      console.log('[3] LicenseGuard 行为');
      const guard = makeGuard(svc, false);
      assertThrows(() => guard.canActivate(mockCtx), '不放行时 canActivate 抛异常',
        (e) => e instanceof BizException && e.bizCode === LICENSE_DISABLED_CODE);
      const publicGuard = makeGuard(svc, true);
      assert(publicGuard.canActivate(mockCtx) === true, '@LicensePublic 路由放行');
    }

    // === 4. activate -> 放行 ===
    console.log('[4] activate -> 放行');
    {
      const svc = new LicenseService(makeConfig(cfgVars));
      await svc.refresh(); // inactive
      await fetchJson(`http://localhost:${PORT}/admin/activate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD, days: 10 }),
      });
      await svc.refresh();
      assert(svc.isAllowed() === true, 'activate 后 isAllowed=true');
      assert(svc.getStatus().status === 'trial', `status=trial（实际 ${svc.getStatus().status}）`);
      const guard = makeGuard(svc, false);
      assert(guard.canActivate(mockCtx) === true, 'activate 后 Guard 放行');
    }

    // === 5. 过期 -> 锁回 ===
    console.log('[5] trial 过期 -> 锁回');
    {
      const svc = new LicenseService(makeConfig(cfgVars));
      await svc.refresh(); // trial allowed
      assert(svc.isAllowed() === true, '过期前 isAllowed=true');
      await fetchJson(`http://localhost:${PORT}/test/expire`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: LICENSE_ID }),
      });
      await svc.refresh();
      assert(svc.isAllowed() === false, '过期后 isAllowed=false');
      assert(svc.getStatus().status === 'trial', '过期后 status 仍 trial（仅 allowed 翻 false）');
    }

    // === 6. unlock -> 永久放行 ===
    console.log('[6] unlock -> 永久放行');
    {
      const svc = new LicenseService(makeConfig(cfgVars));
      await fetchJson(`http://localhost:${PORT}/admin/unlock`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD }),
      });
      await svc.refresh();
      assert(svc.isAllowed() === true, 'unlock 后 isAllowed=true');
      assert(svc.getStatus().status === 'active', 'unlock 后 status=active');
    }

    // === 7. lock -> 手动停服 ===
    console.log('[7] lock -> 手动停服');
    {
      const svc = new LicenseService(makeConfig(cfgVars));
      await fetchJson(`http://localhost:${PORT}/admin/lock`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD }),
      });
      await svc.refresh();
      assert(svc.isAllowed() === false, 'lock 后 isAllowed=false');
      assert(svc.getStatus().status === 'locked', 'lock 后 status=locked');
    }

    // === 8. 断网 fail-closed + 容忍窗口 ===
    console.log('[8] 断网：容忍窗口内保留态、未成功 check 过则 fail-closed');
    {
      // 重置为 active 并 refresh 一次
      await fetchJson(`http://localhost:${PORT}/admin/unlock`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD }),
      });
      const svc = new LicenseService(makeConfig(cfgVars));
      await svc.refresh();
      assert(svc.isAllowed() === true, '断网前 isAllowed=true');
      // 指向不存在的端口模拟断网；refresh 失败应保留上次态
      const svc2 = new LicenseService(makeConfig({ ...cfgVars, LICENSE_SERVER_URL: 'http://localhost:1' }));
      await svc2.refresh(); // 此 svc2 从未成功 -> fail-closed
      assert(svc2.isAllowed() === false, '从未成功 check 的实例 isAllowed=false（fail-closed）');
      // svc（已成功过）即便不再 refresh，容忍窗口内仍放行（验证上次态保留逻辑）
      assert(svc.isAllowed() === true, '已成功 check 的实例容忍窗口内仍 isAllowed=true');
    }

    // === 9. CLI ===
    console.log('[9] license-cli');
    // 先把 license 重置回 active，便于 CLI 测 activate
    await fetchJson(`http://localhost:${PORT}/admin/unlock`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD }),
    });
    const cliPath = path.resolve(__dirname, '../../dist/license/license-cli.js');
    if (!fs.existsSync(cliPath)) {
      console.warn('  ⚠ 跳过 CLI 测试：dist/license/license-cli.js 不存在，请先 `pnpm --filter @yitong/server build`');
    } else {
      const env = { ...cfgVars, PORT: '65500' }; // PORT 指向无服务端口，CLI 触发本地刷新会 warn（预期）
      const status = await runCli(['status'], env);
      assert(status.code === 0 && /授权状态/.test(status.out), `status 命令输出正常（exit=${status.code}）`);
      const wrong = await runCli(['lock', '--password', 'wrong-pw'], env);
      assert(wrong.code !== 0 && /失败|403|密码错误/.test(wrong.out + wrong.err), '错误密码被拒');
      const ok = await runCli(['activate', '--password', PASSWORD, '--days', '10'], env);
      assert(ok.code === 0 && /成功/.test(ok.out), `activate 命令成功（exit=${ok.code}）`);
      const statusAfter = await runCli(['status'], env);
      assert(/trial/.test(statusAfter.out), `activate 后 status=trial（输出: ${statusAfter.out.trim()}）`);
      const unlock = await runCli(['unlock', '--password', PASSWORD], env);
      assert(unlock.code === 0 && /成功/.test(unlock.out), 'unlock 命令成功');
      const statusFinal = await runCli(['status'], env);
      assert(/active/.test(statusFinal.out), `unlock 后 status=active（输出: ${statusFinal.out.trim()}）`);
    }

    console.log(`\n==== 冒烟测试结果：${passed} 通过 / ${failed} 失败 ====`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    // 清理：清空假授权服务器内存态 + 关闭
    store.clear();
    fake.close();
  }
}

main().catch((e) => { console.error('冒烟测试异常:', e); process.exit(1); });
