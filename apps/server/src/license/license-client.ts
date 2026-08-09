// 授权服务器 HTTP 调用（纯函数，无 Nest 依赖；LicenseService 与 license-cli 共用，避免重复）

export interface CheckResult {
  allowed: boolean;
  status: string;
  expiresAt?: number;
  serverTime?: number;
}

export interface AdminResult {
  ok: boolean;
  status?: string;
  expiresAt?: number;
  error?: string;
  httpStatus: number;
}

const TIMEOUT_MS = 10_000;

function withTimeout(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function baseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

/** POST /check：查询是否放行 + 倒计时到期时间。失败抛异常（由调用方决定保留上次态）。 */
export async function checkLicense(opts: {
  serverUrl: string;
  licenseId: string;
  apiKey: string;
}): Promise<CheckResult> {
  const { signal, cancel } = withTimeout();
  try {
    const res = await fetch(`${baseUrl(opts.serverUrl)}/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-license-key': opts.apiKey },
      body: JSON.stringify({ licenseId: opts.licenseId }),
      signal,
    });
    if (!res.ok) throw new Error(`/check HTTP ${res.status}`);
    return (await res.json()) as CheckResult;
  } finally {
    cancel();
  }
}

/** POST /admin/{activate|unlock|lock}：密码鉴权的管理操作。 */
export async function adminAction(opts: {
  serverUrl: string;
  licenseId: string;
  password: string;
  action: 'activate' | 'unlock' | 'lock';
  days?: number;
}): Promise<AdminResult> {
  const body: Record<string, unknown> = { licenseId: opts.licenseId, password: opts.password };
  if (opts.action === 'activate' && opts.days !== undefined) body.days = opts.days;
  const { signal, cancel } = withTimeout();
  try {
    const res = await fetch(`${baseUrl(opts.serverUrl)}/admin/${opts.action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      status?: string;
      expiresAt?: number;
      error?: string;
    };
    return {
      ok: res.ok && data.ok === true,
      status: data.status,
      expiresAt: data.expiresAt,
      error: data.error,
      httpStatus: res.status,
    };
  } finally {
    cancel();
  }
}
