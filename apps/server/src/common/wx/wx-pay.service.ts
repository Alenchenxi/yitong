import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import { BizException } from '../exceptions/biz.exception';

// 微信支付 V3（JSAPI 下单 / 回调验签解密 / 退款 / 查询）封装层。
// 仅做真实调用；凭证缺失时 isReady()=false，由 PaymentService 决定 mock/real/90003。
// 金额单位：微信支付接口用「分」，本服务入参 amountInFen 已是整数分。
//
// 依赖：wechatpay-node-v3（klover2）。平台证书（验签用）由 SDK verifySign 自动
// 拉取/缓存/轮换（/v3/certificates + API v3 key 解密）。JSAPI 支付参数（timeStamp/
// nonceStr/package/signType/paySign）由 transactions_jsapi 内部签名后随 result.data 返回。

export interface WxPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string; // "prepay_id=xxx"
  signType: 'RSA';
  paySign: string;
}

export interface JsapiOrderResult {
  prepayId: string;
  wxPayParams: WxPayParams;
}

export interface RefundResult {
  refundId: string; // 微信退款单号
  status: string; // SUCCESS / PROCESSING / CLOSED / ABNORMAL
}

export interface OrderQueryResult {
  transactionId: string;
  tradeState: string; // SUCCESS / REFUND / NOTPAY / CLOSED / REVOKED / USERPAYING / PAYERROR
}

export interface RefundQueryResult {
  refundId: string;
  status: string;
}

// 回调解密后的 resource（支付/退款回调字段并集，按场景取用）
export interface DecryptedResource {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  out_refund_no?: string;
  refund_id?: string;
  refund_status?: string; // SUCCESS / CLOSED / PROCESSING / ABNORMAL
  [k: string]: unknown;
}

@Injectable()
export class WxPayService {
  private readonly logger = new Logger(WxPayService.name);
  private readonly sdk: any = null;
  private readonly ready: boolean;

  constructor(private readonly config: ConfigService) {
    const appid = this.config.get<string>('WX_USER_APPID');
    const mchid = this.config.get<string>('WX_PAY_MCH_ID');
    const apiV3Key = this.config.get<string>('WX_PAY_API_V3_KEY');
    const serial = this.config.get<string>('WX_PAY_CERT_SERIAL');
    const keyPath = this.config.get<string>('WX_PAY_PRIVATE_KEY_PATH');
    const certPath = this.config.get<string>('WX_PAY_CERT_PATH');

    this.ready = !!(appid && mchid && apiV3Key && serial && keyPath && certPath);
    if (!this.ready) {
      this.logger.warn('WX Pay credentials incomplete; real pay disabled (dev mock / prod 90003)');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WxPay = require('wechatpay-node-v3');
      this.sdk = new WxPay({
        appid,
        mchid,
        publicKey: fs.readFileSync(certPath!), // 商户证书 apiclient_cert.pem
        privateKey: fs.readFileSync(keyPath!), // 商户私钥 apiclient_key.pem
        key: apiV3Key, // API v3 密钥（回调解密 + 平台证书拉取）
        serial_no: serial, // 商户证书序列号
      });
    } catch (e) {
      this.logger.error(`WX Pay SDK init failed: ${(e as Error).message}`);
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private ensure(): void {
    if (!this.ready) {
      throw new BizException(90003, '微信支付凭证未配置或 SDK 初始化失败');
    }
  }

  private errMsg(res: any): string {
    return res?.error?.message ?? res?.errRaw ?? JSON.stringify(res?.data ?? res);
  }

  // JSAPI 下单：SDK 内部签名并返回 wx.requestPayment 所需五元组（result.data）
  async createJsapiOrder(input: {
    outTradeNo: string;
    amountInFen: number;
    description: string;
    openid: string;
    notifyUrl: string;
  }): Promise<JsapiOrderResult> {
    this.ensure();
    const res = await this.sdk.transactions_jsapi({
      description: input.description,
      out_trade_no: input.outTradeNo,
      notify_url: input.notifyUrl,
      amount: { total: input.amountInFen, currency: 'CNY' },
      payer: { openid: input.openid },
    });
    if (res.status !== 200 || !res.data?.paySign) {
      throw new BizException(90003, `微信下单失败：${this.errMsg(res)}`);
    }
    const wxPayParams: WxPayParams = {
      timeStamp: res.data.timeStamp,
      nonceStr: res.data.nonceStr,
      package: res.data.package,
      signType: 'RSA',
      paySign: res.data.paySign,
    };
    const prepayId = res.data.package?.startsWith('prepay_id=')
      ? res.data.package.slice('prepay_id='.length)
      : '';
    return { prepayId, wxPayParams };
  }

  // 回调验签 + AES-GCM 解密 resource。headers 含 Wechatpay-Signature/Serial/Timestamp/Nonce。
  // SDK verifySign 自动拉取平台证书；decipher_gcm 已 JSON.parse 返回对象。
  async verifyAndDecryptCallback(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): Promise<DecryptedResource> {
    this.ensure();
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const signature = headers['wechatpay-signature'];
    const serial = headers['wechatpay-serial'];
    if (!timestamp || !nonce || !signature || !serial) {
      throw new BizException(90003, '微信回调缺少验签 header');
    }
    const ok = await this.sdk.verifySign({ timestamp, nonce, body: rawBody, serial, signature });
    if (!ok) {
      throw new BizException(90003, '微信回调验签失败');
    }
    let parsed: { resource?: { ciphertext: string; associated_data?: string; nonce: string } };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new BizException(90003, '微信回调 body 非合法 JSON');
    }
    const r = parsed.resource;
    if (!r) throw new BizException(90003, '微信回调缺少 resource');
    return this.sdk.decipher_gcm(r.ciphertext, r.associated_data ?? '', r.nonce) as DecryptedResource;
  }

  // 申请退款：返回微信退款单号 + 状态（退款异步，最终状态由 refund-notify 回调确认）
  async createRefund(input: {
    outTradeNo: string;
    outRefundNo: string;
    amountInFen: number;
    refundAmountInFen: number;
    reason?: string;
    notifyUrl: string;
  }): Promise<RefundResult> {
    this.ensure();
    const res = await this.sdk.refunds({
      out_trade_no: input.outTradeNo,
      out_refund_no: input.outRefundNo,
      reason: input.reason,
      amount: {
        refund: input.refundAmountInFen,
        total: input.amountInFen,
        currency: 'CNY',
      },
      notify_url: input.notifyUrl,
    });
    if (res.status !== 200 || !res.data?.refund_id) {
      throw new BizException(90003, `微信退款申请失败：${this.errMsg(res)}`);
    }
    return { refundId: res.data.refund_id, status: res.data.status ?? 'PROCESSING' };
  }

  // 查订单状态（M6-05 兜底）：按商户单号查微信支付单状态
  async queryOrder(outTradeNo: string): Promise<OrderQueryResult> {
    this.ensure();
    const res = await this.sdk.query({ out_trade_no: outTradeNo });
    if (res.status !== 200) {
      throw new BizException(90003, `微信查单失败：${this.errMsg(res)}`);
    }
    return {
      transactionId: res.data?.transaction_id ?? '',
      tradeState: res.data?.trade_state ?? 'UNKNOWN',
    };
  }

  // 查退款状态（M6-05 兜底）
  async queryRefund(outRefundNo: string): Promise<RefundQueryResult> {
    this.ensure();
    const res = await this.sdk.find_refunds(outRefundNo);
    if (res.status !== 200) {
      throw new BizException(90003, `微信查退款失败：${this.errMsg(res)}`);
    }
    return {
      refundId: res.data?.refund_id ?? '',
      status: res.data?.status ?? 'UNKNOWN',
    };
  }
}
