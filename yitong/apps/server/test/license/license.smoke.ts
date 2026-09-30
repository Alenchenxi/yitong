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
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
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
interface FakeLicense { password: string; status: string; activatedAt: number; durationMs: number; lastIntegrityHash?: string; tamperedSince?: number; }
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
        const lic = store.get(String(body.licenseId));
        const reported = body.integrityHash === undefined || body.integrityHash === null ? '' : String(body.integrityHash);
        let tampered = false;
        if (lic && reported) {
          if (!lic.lastIntegrityHash) { lic.lastIntegrityHash = reported; }
          else if (lic.lastIntegrityHash !== reported) { tampered = true; if (!lic.tamperedSince) lic.tamperedSince = Date.now(); lic.lastIntegrityHash = reported; }
        }
        return json({ ...compute(lic, Date.now()), serverTime: Date.now(), tampered });
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

    // === 10. 完整性检测（dist/license/*.js 防篡改） ===
    console.log('[10] 完整性检测：bootHash 一致 -> 放行；不一致 -> 锁定');
    {
      // 在测试目录下造一个临时 dist/license/，让 LicenseService 扫描用
      const tmpDist = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yitong-license-int-'));
      const tmpLicenseDir = path.join(tmpDist, 'license');
      fs.mkdirSync(tmpLicenseDir, { recursive: true });
      fs.writeFileSync(path.join(tmpLicenseDir, 'license.guard.js'), '// guard\n');
      fs.writeFileSync(path.join(tmpLicenseDir, 'license.service.js'), '// service\n');

      const { computeIntegrityHash } = await import('../../src/license/integrity');
      const goodHash = computeIntegrityHash(tmpDist).hash;
      assert(/^[a-f0-9]{64}$/.test(goodHash), `computeIntegrityHash 返回 64 位 hex（实际 ${goodHash.slice(0, 8)}…）`);

      const origEnvDistDir = process.env.LICENSE_DIST_DIR;
      const origCwd = process.cwd();

      // 10a. bootHash 与 computedHash 一致 -> 不视为篡改
      process.env.LICENSE_DIST_DIR = tmpDist; // 让 LicenseService 直接扫 tmpDist（含 license 子目录）
      try {
        const cfg10 = { ...cfgVars, LICENSE_BOOT_HASH: goodHash };
        const svc = new LicenseService(makeConfig(cfg10));
        await fetchJson(`http://localhost:${PORT}/admin/unlock`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD }),
        });
        await svc.refresh();
        assert(svc.isAllowed() === true, 'bootHash 匹配 -> isAllowed=true');
        assert(svc.getStatus().localTampered === false, 'localTampered=false');
      } finally {
        process.env.LICENSE_DIST_DIR = origEnvDistDir;
      }

      // 10b. 改 dist -> bootHash 不匹配 -> localTampered=true -> 锁定
      fs.writeFileSync(path.join(tmpLicenseDir, 'license.guard.js'), '// TAMPERED canActivate -> true\n');
      process.env.LICENSE_DIST_DIR = tmpDist;
      try {
        const cfg10b = { ...cfgVars, LICENSE_BOOT_HASH: goodHash };
        const svc = new LicenseService(makeConfig(cfg10b));
        await fetchJson(`http://localhost:${PORT}/admin/unlock`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD }),
        });
        await svc.refresh();
        assert(svc.isAllowed() === false, '本地篡改 -> isAllowed=false');
        assert(svc.getStatus().localTampered === true, 'localTampered=true');
      } finally {
        process.env.LICENSE_DIST_DIR = origEnvDistDir;
      }

      // 10c. 授权服务器发现 serverReportedTampered -> 锁定
      // 造两个不同内容的 dist，让两个 svc 实例分别算不同 hash。
      // 第一个 svc 上报 hashA，server 记录基线；第二个 svc 上报 hashB -> server 返回 tampered=true。
      // 注意：10a/10b 已经给 store.lastIntegrityHash 写过 goodHash，需先 /test/reset 清空。
      await fetchJson(`http://localhost:${PORT}/test/reset`, { method: 'POST' });
      // 重新 create + activate 让 license 处于 allowed 状态
      await fetchJson(`http://localhost:${PORT}/admin/create`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-master-key': MASTER_KEY },
        body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD, days: 10 }),
      });
      await fetchJson(`http://localhost:${PORT}/admin/activate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ licenseId: LICENSE_ID, password: PASSWORD, days: 10 }),
      });

      const tmpDistA = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yitong-license-A-'));
      const tmpDistB = fs.mkdtempSync(path.join(require('os').tmpdir(), 'yitong-license-B-'));
      fs.mkdirSync(path.join(tmpDistA, 'license'), { recursive: true });
      fs.mkdirSync(path.join(tmpDistB, 'license'), { recursive: true });
      fs.writeFileSync(path.join(tmpDistA, 'license/license.guard.js'), 'A');
      fs.writeFileSync(path.join(tmpDistB, 'license/license.guard.js'), 'B');
      const hashA = computeIntegrityHash(tmpDistA).hash;
      const hashB = computeIntegrityHash(tmpDistB).hash;
      assert(hashA !== hashB, `两个 dist 哈希不同（${hashA.slice(0,6)} vs ${hashB.slice(0,6)}）`);

      // 关掉本地检测只看服务器反馈：给 bootHash 一个占位值（任意），通过 LICENSE_LOCAL_CHECK_ENABLED=false
      // 关闭本地比对，但仍会让 hash 发到 /check（用于 server 端 hash 漂移检测）。
      const cfgC = { ...cfgVars, LICENSE_BOOT_HASH: 'placeholder', LICENSE_LOCAL_CHECK_ENABLED: 'false' };

      process.env.LICENSE_DIST_DIR = tmpDistA;
      try {
        const svcA = new LicenseService(makeConfig(cfgC));
        await svcA.refresh();
        assert(svcA.isAllowed() === true, 'svcA 上报 hashA -> 放行');
        assert(svcA.getStatus().serverReportedTampered === false, '首次上报 hashA -> serverReportedTampered=false');
      } finally {
        process.env.LICENSE_DIST_DIR = origEnvDistDir;
      }
      process.env.LICENSE_DIST_DIR = tmpDistB;
      try {
        const svcB = new LicenseService(makeConfig(cfgC));
        await svcB.refresh();
        // store 中是 hashA，上报 hashB -> server 返回 tampered=true
        assert(svcB.isAllowed() === false, 'svcB 上报 hashB（与 store 中 hashA 不同）-> 锁定');
        assert(svcB.getStatus().serverReportedTampered === true, 'serverReportedTampered=true');
      } finally {
        process.env.LICENSE_DIST_DIR = origEnvDistDir;
      }

      // 清理临时目录
      fs.rmSync(tmpDist, { recursive: true, force: true });
      fs.rmSync(tmpDistA, { recursive: true, force: true });
      fs.rmSync(tmpDistB, { recursive: true, force: true });
      await fetchJson(`http://localhost:${PORT}/test/reset`, { method: 'POST' });
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
