/* eslint-disable no-console */
/**
 * 试用授权锁 CLI（独立脚本，不引 NestJS）
 *
 * 用法（在客户服务器上 docker exec 运行）：
 *   docker exec yitong-server node dist/license/license-cli.js activate [--password <p>] [--days 10]
 *   docker exec yitong-server node dist/license/license-cli.js unlock  [--password <p>]
 *   docker exec yitong-server node dist/license/license-cli.js lock    [--password <p>]
 *   docker exec yitong-server node dist/license/license-cli.js status
 *
 * --password 缺省且为交互终端（docker exec -it）时静默提示输入，避免进 shell 历史。
 * activate/unlock/lock 成功后会通知运行中的服务（POST /api/v1/license/refresh）立即同步本地态。
 *
 * 从 process.env 读：LICENSE_SERVER_URL / LICENSE_ID / LICENSE_API_KEY / PORT / LICENSE_TRIAL_DAYS。
 */

import readline from 'node:readline';
import { adminAction, checkLicense, type AdminResult } from './license-client';

type Command = 'activate' | 'unlock' | 'lock' | 'status';

interface Args {
  command: Command | null;
  password?: string;
  days?: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--password') {
      args.password = argv[++i];
    } else if (a.startsWith('--password=')) {
      args.password = a.slice('--password='.length);
    } else if (a === '--days') {
      args.days = Number(argv[++i]);
    } else if (a.startsWith('--days=')) {
      args.days = Number(a.slice('--days='.length));
    } else if (!args.command) {
      args.command = a as Command;
    }
  }
  return args;
}

function usage(): never {
  console.log(`燚桐试用授权锁 CLI

用法:
  node dist/license/license-cli.js activate [--password <p>] [--days 10]   开启/重置试用倒计时
  node dist/license/license-cli.js unlock  [--password <p>]                永久激活（停止倒计时，已付费）
  node dist/license/license-cli.js lock    [--password <p>]                手动停服
  node dist/license/license-cli.js status                                  查看授权状态

交互终端可省略 --password（docker exec -it ...），会静默提示输入。
环境变量：LICENSE_SERVER_URL / LICENSE_ID / LICENSE_API_KEY / PORT / LICENSE_TRIAL_DAYS`);
  process.exit(1);
}

function askPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('非交互终端，请用 --password <密码> 传入，或用 docker exec -it 提供伪终端'));
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const writeOrig = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (chunk: string) => {
      if (chunk === prompt) writeOrig(chunk);
      else if (chunk === '\r\n' || chunk === '\n') writeOrig('\n');
      else writeOrig('*');
    };
    rl.question(prompt, (answer) => {
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = writeOrig;
      rl.close();
      resolve(answer);
    });
  });
}

function readEnv() {
  const serverUrl = (process.env.LICENSE_SERVER_URL || '').trim();
  const licenseId = (process.env.LICENSE_ID || '').trim();
  const apiKey = (process.env.LICENSE_API_KEY || '').trim();
  const port = Number(process.env.PORT) || 3000;
  const trialDays = Number(process.env.LICENSE_TRIAL_DAYS) || 10;
  if (!serverUrl || !licenseId || !apiKey) {
    console.error('✗ 授权环境变量未配置：LICENSE_SERVER_URL / LICENSE_ID / LICENSE_API_KEY');
    console.error('  请在容器 env（.env.production）中设置后重试。');
    process.exit(2);
  }
  return { serverUrl, licenseId, apiKey, port, trialDays };
}

async function triggerLocalRefresh(port: number): Promise<void> {
  try {
    const res = await fetch(`http://localhost:${port}/api/v1/license/refresh`, { method: 'POST' });
    if (res.ok) {
      console.log('✓ 已通知运行中的服务刷新授权态');
    } else {
      console.warn(`⚠ 本地服务刷新返回 HTTP ${res.status}（下次巡检最长 30 分钟自动同步）`);
    }
  } catch (e) {
    console.warn(`⚠ 未能通知本地服务刷新（可能未运行）：${(e as Error).message}`);
    console.warn('  下次巡检（最长 30 分钟）会自动同步。');
  }
}

function printAdminResult(cmd: Command, r: AdminResult): void {
  if (r.ok) {
    const detail = r.expiresAt ? `、到期 ${new Date(r.expiresAt).toISOString()}` : '';
    console.log(`✓ ${cmd} 成功（status=${r.status ?? 'unknown'}${detail}）`);
  } else {
    console.error(`✗ ${cmd} 失败：${r.error ?? `HTTP ${r.httpStatus}`}`);
    if (r.httpStatus === 403) console.error('  密码错误（连续 5 次将锁定 15 分钟）。');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command) usage();
  const env = readEnv();

  if (args.command === 'status') {
    try {
      const r = await checkLicense({
        serverUrl: env.serverUrl,
        licenseId: env.licenseId,
        apiKey: env.apiKey,
      });
      const exp = r.expiresAt ? new Date(r.expiresAt).toISOString() : '无（永久或未激活）';
      console.log(`授权状态: status=${r.status} allowed=${r.allowed} 到期=${exp}`);
    } catch (e) {
      console.error(`✗ 查询失败：${(e as Error).message}`);
      process.exit(1);
    }
    return;
  }

  // activate / unlock / lock 需要密码
  let password = args.password;
  if (!password) password = await askPassword('停止密码: ');
  if (!password) {
    console.error('✗ 未提供密码');
    process.exit(1);
  }

  const days = args.command === 'activate' ? (args.days ?? env.trialDays) : undefined;
  const result = await adminAction({
    serverUrl: env.serverUrl,
    licenseId: env.licenseId,
    password,
    action: args.command,
    days,
  });
  printAdminResult(args.command, result);
  if (result.ok) await triggerLocalRefresh(env.port);
}

main().catch((e) => {
  console.error(`✗ 异常：${(e as Error).message}`);
  process.exit(1);
});
