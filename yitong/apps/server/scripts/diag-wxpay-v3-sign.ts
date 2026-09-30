/**
 * V3 签名联调诊断（零副作用，不创建真实微信订单）
 *
 * 用 .env 真实凭证实例化 WxPayService，调一次真实 JSAPI 下单（假 openid）。
 * 微信校验顺序：先验签名 -> 再验业务参数(appid/openid/金额)。
 *   - 仍报「签名错误」-> 序列号与私钥/证书仍不配套（或私钥本身不对）
 *   - 报别的错（openid/appid/金额）-> 签名已通过，序列号修对了
 *   - 返回 prepay_id -> 全通（假 openid 一般到不了这步）
 * 任一被拒阶段都不会在微信侧建单，无副作用。脚本不打印任何凭证值。
 *
 * 运行（在 apps/server 下）：
 *   npx ts-node --transpile-only scripts/diag-wxpay-v3-sign.ts
 */
// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import { WxPayService } from '../src/common/wx/wx-pay.service';

const SERVER_DIR = path.resolve(__dirname, '..');

function loadEnv(): Record<string, string> {
  const envPath = path.join(SERVER_DIR, '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

(async () => {
  const env = loadEnv();
  const configStub = {
    get<T = unknown>(k: string): T {
      return (k in env ? env[k] : undefined) as T;
    },
  };
  const svc = new WxPayService(configStub as any);

  console.log('[diag] isReady =', svc.isReady());
  if (!svc.isReady()) {
    console.log('[diag] 凭证不齐，无法测真实路径。缺失项（只报有/无，不打印值）：');
    const checks: Array<[string, boolean]> = [
      ['WX_USER_APPID', !!env.WX_USER_APPID],
      ['WX_PAY_MCH_ID', !!env.WX_PAY_MCH_ID],
      ['WX_PAY_API_V3_KEY (需 32 位)', (env.WX_PAY_API_V3_KEY || '').length === 32],
      ['WX_PAY_PRIVATE_KEY 或 _PATH', !!(env.WX_PAY_PRIVATE_KEY || env.WX_PAY_PRIVATE_KEY_PATH)],
      ['WX_PAY_MCH_SERIAL_NO', !!env.WX_PAY_MCH_SERIAL_NO],
      ['WX_PAY_PLATFORM_PUBLIC_KEY 或 _PATH', !!(env.WX_PAY_PLATFORM_PUBLIC_KEY || env.WX_PAY_PLATFORM_PUBLIC_KEY_PATH)],
    ];
    for (const [k, ok] of checks) console.log(`  ${ok ? '✓' : '✗'} ${k}`);
    process.exit(0);
  }

  console.log('[diag] 凭证齐全，调真实 JSAPI 下单（假 openid，零副作用）...');
  try {
    const r = await svc.createJsapiOrder({
      outTradeNo: `diag${Date.now().toString(36)}`,
      amountInFen: 1,
      description: 'V3签名诊断',
      openid: 'oDIAG_FAKE_OPENID_NOT_REAL',
      notifyUrl: env.WX_PAY_NOTIFY_URL || 'https://example.com/api/v1/payments/notify',
    });
    console.log('[diag] ✓ 微信接受签名并返回 prepay_id（凭证完全有效）');
    console.log('  prepayId =', r.prepayId);
    console.log('  signType =', r.wxPayParams.signType);
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.log('[diag] ✗ 微信返回错误:', msg);
    if (msg.includes('签名')) {
      console.log('  => 仍是签名错误：序列号与私钥/证书仍不配套，或私钥本身不对。');
      console.log('     排查：apiclient_key.pem(私钥) 与 apiclient_cert.pem(证书) 必须同一次申请下载；');
      console.log('     WX_PAY_MCH_SERIAL_NO 必须从那张 apiclient_cert.pem 读出（node X509Certificate.serialNumber）。');
    } else {
      console.log('  => 非签名错误：签名已通过！序列号修对了。');
      console.log('     此错误来自业务参数校验（openid 是假的/appid 与 mchid 不匹配等），凭证签名侧已 OK。');
    }
  }
})();
