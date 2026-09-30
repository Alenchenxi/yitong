/**
 * 微信支付 V3 签名/验签/解密 roundtrip smoke（独立脚本，不依赖真实微信）
 *
 * 覆盖契约：
 * 1. 生成 RSA keypair + 加载临时证书文件 + 假 ConfigService 注入 -> WxPayService.isReady=true
 * 2. createJsapiOrder：
 *    - 拦截 fetch 捕获 Authorization 头 + 请求体（POST /v3/pay/transactions/jsapi）
 *    - 用「商户公钥」验 Authorization 签名（RSA-SHA256 over METHOD\nURL\nts\nnonce\nbody）
 *    - 用「商户公钥」验返回的 wxPayParams.paySign（RSA-SHA256 over appId\nts\nnonce\npkg\n）
 *    - 校验请求体 mchid/appid/amount.total/payer.openid/notify_url 字段
 * 3. verifyAndParseCallback：
 *    - 脚本用「平台私钥」对回调签名（ts\nnonce\nbody\n -> RSA-SHA256 -> base64）
 *    - 用 APIv3 密钥 AES-256-GCM 加密 resource{ciphertext, nonce, associated_data}
 *    - 真实 WxPayService.verifyAndParseCallback(headers, rawBody) 解出 out_trade_no/transaction_id
 * 4. 反例：篡改签名 -> 抛 90003；篡改密文 -> 抛 90003
 * 5. queryOrder / refund 路径：stub fetch，校验 URL 拼接与返回解析
 * 6. 清理临时密钥文件
 *
 * 运行（在 apps/server 下）：
 *   npx ts-node --transpile-only scripts/smoke-wxpay-v3-crypto.ts
 */
// @ts-nocheck
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WxPayService } from '../src/common/wx/wx-pay.service';

const API_V3_KEY = '0123456789abcdef0123456789abcdef'; // 32 位
const APPID = 'wxappid_test000000';
const MCHID = '1900000001';
const MCH_SERIAL = 'MERCHANT_SERIAL_TEST';

function assert(condition: boolean, message: string, evidence = ''): void {
  if (!condition) {
    console.error(`  ✗ ${message}${evidence ? ` | ${evidence}` : ''}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}${evidence ? ` | ${evidence}` : ''}`);
}

function assertEq(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message, `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}

function makeKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
}
function pemPriv(key: crypto.KeyObject) {
  return key.export({ type: 'pkcs8', format: 'pem' }) as string;
}
function pemPub(key: crypto.KeyObject) {
  return key.export({ type: 'spki', format: 'pem' }) as string;
}
function rsaSign(privPem: string, message: string): string {
  return crypto.sign('sha256', Buffer.from(message, 'utf8'), privPem).toString('base64');
}
function rsaVerify(pubPem: string, message: string, signatureB64: string): boolean {
  return crypto.verify('sha256', Buffer.from(message, 'utf8'), pubPem, Buffer.from(signatureB64, 'base64'));
}

// 用 APIv3 密钥 AES-256-GCM 加密；nonce 为 12 字符字符串（与微信 V3 一致），密文+authTag 拼一起 base64
function encryptResource(apiV3Key: string, plaintext: string, associatedData: string) {
  const key = Buffer.from(apiV3Key, 'utf8');
  const nonce = crypto.randomBytes(12).toString('base64').slice(0, 12); // 12 字符字符串
  const cipher = crypto.createCipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  if (associatedData) cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, authTag]).toString('base64'),
    nonce,
    associated_data: associatedData,
  };
}

function parseAuthHeader(authHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of authHeader.replace(/^WECHATPAY2-SHA256-RSA2048\s*/, '').split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).replace(/^"|"$/g, '').trim();
    map[k] = v;
  }
  return map;
}

async function main() {
  console.log('[wxpay v3 crypto smoke] start');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wxpayv3-'));
  try {
    // 1. 生成两对 RSA 密钥
    const { privateKey: merchantPriv, publicKey: merchantPub } = makeKeyPair();
    const { privateKey: platformPriv, publicKey: platformPub } = makeKeyPair();
    const merchantPrivPath = path.join(tmpDir, 'mch_priv.pem');
    const platformPubPath = path.join(tmpDir, 'platform_pub.pem');
    fs.writeFileSync(merchantPrivPath, pemPriv(merchantPriv));
    fs.writeFileSync(platformPubPath, pemPub(platformPub));
    console.log(`  密钥生成完成 -> ${tmpDir}`);

    // 2. 假 ConfigService 注入凭证
    const configMap: Record<string, string> = {
      WX_USER_APPID: APPID,
      WX_PAY_MCH_ID: MCHID,
      WX_PAY_API_V3_KEY: API_V3_KEY,
      WX_PAY_MCH_SERIAL_NO: MCH_SERIAL,
      WX_PAY_PRIVATE_KEY_PATH: merchantPrivPath,
      WX_PAY_PLATFORM_PUBLIC_KEY_PATH: platformPubPath,
      WX_PAY_NOTIFY_URL: 'https://example.com/api/v1/payments/notify',
    };
    const configStub = {
      get<T = unknown>(name: string): T {
        return (Object.prototype.hasOwnProperty.call(configMap, name) ? configMap[name] : undefined) as T;
      },
    };
    const svc = new WxPayService(configStub as any);
    assert(svc.isReady() === true, '契约点1：凭证齐全时 isReady()=true');

    // 3. createJsapiOrder：拦截 fetch，验 Authorization + paySign
    const captured: { url: string | null; method: string | null; body: string | null; auth: string | null } = {
      url: null, method: null, body: null, auth: null,
    };
    const realFetch = global.fetch;
    global.fetch = (async (url: any, init?: any) => {
      captured.url = String(url);
      captured.method = init?.method;
      captured.body = init?.body;
      captured.auth = init?.headers?.Authorization;
      return new Response(JSON.stringify({ prepay_id: 'wxtest_prepay_12345' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const result = await svc.createJsapiOrder({
        outTradeNo: 'order_test_001',
        amountInFen: 900,
        description: 'smoke test job',
        openid: 'oMock_openid_abc',
        notifyUrl: 'https://example.com/api/v1/payments/notify',
      });
      assertEq(captured.url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi', 'createJsapiOrder URL');
      assertEq(captured.method, 'POST', 'createJsapiOrder method');
      const parsed = JSON.parse(captured.body as string);
      assertEq(parsed.appid, APPID, 'createJsapiOrder 请求体 appid');
      assertEq(parsed.mchid, MCHID, 'createJsapiOrder 请求体 mchid');
      assertEq(parsed.out_trade_no, 'order_test_001', 'createJsapiOrder 请求体 out_trade_no');
      assertEq(parsed.amount.total, 900, 'createJsapiOrder 请求体 amount.total');
      assertEq(parsed.amount.currency, 'CNY', 'createJsapiOrder 请求体 amount.currency');
      assertEq(parsed.payer.openid, 'oMock_openid_abc', 'createJsapiOrder 请求体 payer.openid');

      // 解析 Authorization 头并验签
      const auth = parseAuthHeader(captured.auth as string);
      assertEq(auth.mchid, MCHID, 'Authorization mchid');
      assertEq(auth.serial_no, MCH_SERIAL, 'Authorization serial_no');
      assert(!!auth.signature, 'Authorization signature 存在');
      const urlPath = new URL(captured.url as string).pathname;
      const authMsg = `${captured.method}\n${urlPath}\n${auth.timestamp}\n${auth.nonce_str}\n${captured.body}\n`;
      assert(
        rsaVerify(pemPub(merchantPub), authMsg, auth.signature) === true,
        '契约点2：Authorization 头签名能用商户公钥验签通过',
      );

      // 验 wxPayParams.paySign
      assertEq(result.wxPayParams.signType, 'RSA', 'paySignType=RSA');
      assert(result.wxPayParams.paySign.length > 0, 'paySign 非空');
      const payMsg = `${APPID}\n${result.wxPayParams.timeStamp}\n${result.wxPayParams.nonceStr}\n${result.wxPayParams.package}\n`;
      assert(
        rsaVerify(pemPub(merchantPub), payMsg, result.wxPayParams.paySign) === true,
        '契约点2：paySign 能用商户公钥验签通过',
      );
    } finally {
      global.fetch = realFetch;
    }

    // 4. verifyAndParseCallback：脚本端签名+加密 -> 服务端解密
    const callbackResource = {
      out_trade_no: 'order_test_001',
      transaction_id: '4200000001200000000001',
      trade_state: 'SUCCESS',
      success_time: '2026-08-04T00:00:00+08:00',
    };
    const associatedData = 'transaction';
    const resEnc = encryptResource(API_V3_KEY, JSON.stringify(callbackResource), associatedData);
    const body = JSON.stringify({
      id: 'EV-001',
      create_time: '2026-08-04T00:00:00+08:00',
      resource_type: 'encrypt-resource',
      event_type: 'TRANSACTION.SUCCESS',
      summary: '支付成功',
      resource: resEnc,
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const sigMsg = `${ts}\n${nonce}\n${body}\n`;
    const sig = rsaSign(pemPriv(platformPriv), sigMsg);
    const decoded = svc.verifyAndParseCallback({ timestamp: ts, nonce, signature: sig }, body);
    assertEq(decoded.out_trade_no, 'order_test_001', '契约点3：解密 out_trade_no 一致');
    assertEq(decoded.transaction_id, '4200000001200000000001', '契约点3：解密 transaction_id 一致');
    assertEq(decoded.trade_state, 'SUCCESS', '契约点3：解密 trade_state=SUCCESS');

    // 5. 反例：篡改签名应抛 90003（翻转签名末字节，确保解出的 buffer 真正改变）
    let badThrown = false;
    const sigBuf = Buffer.from(sig, 'base64');
    const tamperedSigBuf = Buffer.concat([
      sigBuf.subarray(0, sigBuf.length - 1),
      Buffer.from([sigBuf[sigBuf.length - 1] ^ 0xff]),
    ]);
    try {
      svc.verifyAndParseCallback({ timestamp: ts, nonce, signature: tamperedSigBuf.toString('base64') }, body);
    } catch (e: any) {
      badThrown = true;
      assert(e.bizCode === 90003, '契约点4a：篡改签名抛 90003', String(e.message));
    }
    assert(badThrown, '契约点4a：篡改签名抛异常');

    // 6. 反例：篡改密文应抛 90003（重新签名使外层验签通过，但内层 AES-GCM authTag 校验失败）
    const tamperedResource = {
      ...resEnc,
      ciphertext: Buffer.concat([Buffer.from(resEnc.ciphertext, 'base64'), Buffer.from([0])]).toString('base64'),
    };
    const tamperedFullBody = JSON.stringify({ ...JSON.parse(body), resource: tamperedResource });
    const sigTampered = rsaSign(pemPriv(platformPriv), `${ts}\n${nonce}\n${tamperedFullBody}\n`);
    let badDec = false;
    try {
      svc.verifyAndParseCallback({ timestamp: ts, nonce, signature: sigTampered }, tamperedFullBody);
    } catch (e: any) {
      badDec = true;
      assert(e.bizCode === 90003, '契约点4b：篡改密文抛 90003', String(e.message));
    }
    assert(badDec, '契约点4b：篡改密文抛异常');

    // 7. queryOrder / refund：stub fetch，校验 URL 拼接与返回解析
    global.fetch = (async (url: any, init?: any) => {
      captured.url = String(url);
      captured.method = init?.method;
      captured.body = init?.body;
      captured.auth = init?.headers?.Authorization;
      return new Response(JSON.stringify({ transaction_id: '4200', trade_state: 'SUCCESS', refund_id: '5000', status: 'SUCCESS' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const q = await svc.queryOrder('order_test_001');
      assertEq(q.tradeState, 'SUCCESS', '契约点5a：queryOrder 返回 trade_state');
      assert((captured.url as string).includes('/v3/pay/transactions/out-trade-no/order_test_001'), '契约点5a：queryOrder URL 正确');
      const r = await svc.refund({
        outTradeNo: 'order_test_001',
        outRefundNo: 'order_test_001_R1',
        reason: 'smoke refund',
        amountInFen: 900,
        notifyUrl: 'https://example.com/api/v1/payments/refund-notify',
      });
      assertEq(r.status, 'SUCCESS', '契约点5b：refund 返回 status');
      assert((captured.url as string).endsWith('/v3/refund/domestic/refunds'), '契约点5b：refund URL 正确');
    } finally {
      global.fetch = realFetch;
    }

    console.log('\n[wxpay v3 crypto smoke] ALL ASSERTIONS PASSED');
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log(`[cleanup] 临时密钥目录 ${tmpDir} 已清理`);
    } catch (e) {
      console.error('[cleanup] 清理失败:', e instanceof Error ? e.message : String(e));
    }
  }
}

main().catch((error) => {
  console.error('\n[wxpay v3 crypto smoke] FAILED:', error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exitCode = 1;
});
