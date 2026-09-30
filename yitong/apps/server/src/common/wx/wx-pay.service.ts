import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { BizException } from '../exceptions/biz.exception';

// 微信支付 V3（JSAPI 下单 / 回调验签解密 / 订单查询 / 退款）封装层。
// 仅做真实调用；凭证缺失时 isReady()=false，由 PaymentService 决定 mock/real/90003。
// 金额单位：微信支付 V3 接口用「分」，入参 amountInFen 已是整数分。
//
// V3 与 V2 区别：V2 用 APIv2 对称密钥做 MD5 签名 + XML；V3 改为——
//   请求签名：商户 API 私钥对「HTTP方法\nURL\n时间戳\n随机串\n请求体\n」做 RSA-SHA256，放 Authorization 头；
//   回调验签：用「微信支付平台公钥」验 Wechatpay-Signature 头（timestamp\nnonce\nbody\n）；
//   回调解密：用 APIv3 密钥（32 位对称）对 resource.ciphertext 做 AES-256-GCM 解密；
//   小程序 wx.requestPayment：signType=RSA，paySign 用商户私钥签「appId\ntimeStamp\nnonceStr\npackage\n」。
// 私钥/平台公钥支持两种配置：环境变量直接给 PEM 内容（多行用 \n 转义），或给 *_PATH 文件路径。

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

export interface OrderQueryResult {
  transactionId: string;
  tradeState: string; // SUCCESS / REFUND / NOTPAY / CLOSED / REVOKED / USERPAYING / PAYERROR
}

// V3 支付回调解密后的 resource 字段（按场景取用）
export interface WxPayNotifyData {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  success_time?: string;
  [k: string]: unknown;
}

// V3 退款回调解密后的 resource 字段
export interface WxRefundNotifyData {
  out_trade_no?: string;
  out_refund_no?: string;
  refund_id?: string;
  refund_status?: string; // SUCCESS / ABNORMAL / CLOSED
  [k: string]: unknown;
}

export interface RefundResult {
  refundId: string;
  status: string; // SUCCESS / PROCESSING / CLOSED / ABNORMAL
}

interface V3NotificationHeaders {
  timestamp?: string;
  nonce?: string;
  signature?: string;
}

@Injectable()
export class WxPayService {
  private readonly logger = new Logger(WxPayService.name);
  private readonly appid: string;
  private readonly mchid: string;
  private readonly apiV3Key: string;
  private readonly privateKey: string;
  private readonly mchSerialNo: string;
  private readonly platformPublicKey: string;
  private readonly ready: boolean;

  constructor(private readonly config: ConfigService) {
    this.appid = this.config.get<string>('WX_USER_APPID') ?? '';
    this.mchid = this.config.get<string>('WX_PAY_MCH_ID') ?? '';
    this.apiV3Key = this.config.get<string>('WX_PAY_API_V3_KEY') ?? '';
    this.privateKey = this.loadPem('WX_PAY_PRIVATE_KEY', 'WX_PAY_PRIVATE_KEY_PATH');
    this.mchSerialNo = this.config.get<string>('WX_PAY_MCH_SERIAL_NO') ?? '';
    this.platformPublicKey = this.loadPem('WX_PAY_PLATFORM_PUBLIC_KEY', 'WX_PAY_PLATFORM_PUBLIC_KEY_PATH');
    this.ready = !!(
      this.appid &&
      this.mchid &&
      this.apiV3Key.length === 32 &&
      this.privateKey &&
      this.mchSerialNo &&
      this.platformPublicKey
    );
    if (!this.ready) {
      this.logger.warn('WX Pay V3 credentials incomplete; real pay disabled (dev mock / prod 90003)');
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

  // PEM 加载：优先环境变量内容（\n 转义还原），其次文件路径
  private loadPem(contentKey: string, pathKey: string): string {
    const content = this.config.get<string>(contentKey);
    if (content) return content.replace(/\\n/g, '\n');
    const filePath = this.config.get<string>(pathKey);
    if (filePath) {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch {
        this.logger.warn(`${pathKey}=${filePath} 读取失败`);
      }
    }
    return '';
  }

  private nonceStr(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // V3 请求签名：HTTP方法\nURL路径(含query)\n时间戳\n随机串\n请求体\n -> 商户私钥 RSA-SHA256 -> base64
  private buildAuthHeader(method: string, urlPath: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = this.nonceStr();
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
    const signature = crypto.sign('sha256', Buffer.from(message, 'utf8'), this.privateKey).toString('base64');
    return (
      `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchid}",nonce_str="${nonce}",` +
      `timestamp="${timestamp}",serial_no="${this.mchSerialNo}",signature="${signature}"`
    );
  }

  // V3 API 调用：签名 -> 请求 -> 非 2xx 抛 90003（带微信侧 code/message）
  private async request<T>(method: 'GET' | 'POST', urlPath: string, payload?: object): Promise<T> {
    this.ensure();
    const body = payload === undefined ? '' : JSON.stringify(payload);
    let res: Response;
    try {
      res = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: this.buildAuthHeader(method, urlPath, body),
        },
        body: body || undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BizException(90003, '微信支付请求超时或网络异常');
    }
    if (res.status === 204) return {} as T;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new BizException(
        90003,
        `微信支付接口失败：${String(data.message ?? data.code ?? `HTTP ${res.status}`)}`,
      );
    }
    return data as T;
  }

  // JSAPI 下单：返回 prepay_id + wx.requestPayment 所需签名参数（signType=RSA）
  async createJsapiOrder(input: {
    outTradeNo: string;
    amountInFen: number;
    description: string;
    openid: string;
    notifyUrl: string;
  }): Promise<JsapiOrderResult> {
    const data = await this.request<{ prepay_id?: string }>('POST', '/v3/pay/transactions/jsapi', {
      appid: this.appid,
      mchid: this.mchid,
      description: input.description,
      out_trade_no: input.outTradeNo,
      notify_url: input.notifyUrl,
      amount: { total: input.amountInFen, currency: 'CNY' },
      payer: { openid: input.openid },
    });
    if (!data.prepay_id) {
      throw new BizException(90003, '微信下单失败：未返回 prepay_id');
    }
    const prepayId = data.prepay_id;
    // wx.requestPayment 签名：appId\ntimeStamp\nnonceStr\npackage\n -> 商户私钥 RSA-SHA256
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.nonceStr();
    const pkg = `prepay_id=${prepayId}`;
    const message = `${this.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
    const paySign = crypto.sign('sha256', Buffer.from(message, 'utf8'), this.privateKey).toString('base64');
    return {
      prepayId,
      wxPayParams: { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign },
    };
  }

  // V3 回调验签：Wechatpay-Timestamp/Nonce/Signature 头，用平台公钥验「timestamp\nnonce\nbody\n」
  private verifyNotification(headers: V3NotificationHeaders, rawBody: string): void {
    this.ensure();
    const { timestamp, nonce, signature } = headers;
    if (!timestamp || !nonce || !signature) {
      throw new BizException(90003, '微信回调缺少验签头');
    }
    // 防重放：回调时间戳与本地相差超 5 分钟拒绝
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) {
      throw new BizException(90003, '微信回调时间戳过期');
    }
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const okVerify = crypto.verify(
      'sha256',
      Buffer.from(message, 'utf8'),
      this.platformPublicKey,
      Buffer.from(signature, 'base64'),
    );
    if (!okVerify) {
      throw new BizException(90003, '微信回调验签失败');
    }
  }

  // V3 回调解密：APIv3 密钥 AES-256-GCM，auth tag 在密文末尾 16 字节
  private decryptResource(resource: {
    ciphertext?: string;
    nonce?: string;
    associated_data?: string;
  }): Record<string, unknown> {
    if (!resource.ciphertext || !resource.nonce) {
      throw new BizException(90003, '微信回调缺少加密资源');
    }
    try {
      const data = Buffer.from(resource.ciphertext, 'base64');
      const authTag = data.subarray(data.length - 16);
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.apiV3Key, 'utf8'),
        Buffer.from(resource.nonce, 'utf8'),
      );
      decipher.setAuthTag(authTag);
      if (resource.associated_data) {
        decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
      }
      const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
      return JSON.parse(plain.toString('utf8')) as Record<string, unknown>;
    } catch {
      // AES-GCM auth tag 校验失败 / JSON 解析失败 -> 统一归为回调验签失败
      throw new BizException(90003, '微信回调解密失败');
    }
  }

  // 支付回调：验签 + 解密，返回订单字段
  verifyAndParseCallback(headers: V3NotificationHeaders, rawBody: string): WxPayNotifyData {
    this.verifyNotification(headers, rawBody);
    const body = JSON.parse(rawBody) as { resource?: { ciphertext?: string; nonce?: string; associated_data?: string } };
    if (!body.resource) throw new BizException(90003, '微信回调缺少 resource');
    return this.decryptResource(body.resource) as WxPayNotifyData;
  }

  // 退款回调：验签 + 解密，返回退款字段
  verifyAndParseRefundCallback(headers: V3NotificationHeaders, rawBody: string): WxRefundNotifyData {
    this.verifyNotification(headers, rawBody);
    const body = JSON.parse(rawBody) as { resource?: { ciphertext?: string; nonce?: string; associated_data?: string } };
    if (!body.resource) throw new BizException(90003, '微信退款回调缺少 resource');
    return this.decryptResource(body.resource) as WxRefundNotifyData;
  }

  // 查订单状态（M6-05 兜底）：按商户单号查微信支付单状态
  async queryOrder(outTradeNo: string): Promise<OrderQueryResult> {
    const data = await this.request<{ transaction_id?: string; trade_state?: string }>(
      'GET',
      `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${this.mchid}`,
    );
    return {
      transactionId: data.transaction_id ?? '',
      tradeState: data.trade_state ?? 'UNKNOWN',
    };
  }

  // 申请退款（V3 退款用同一套 RSA 签名，无需 V2 的 apiclient_cert.p12）
  async refund(input: {
    outTradeNo: string;
    outRefundNo: string;
    reason: string;
    amountInFen: number;
    notifyUrl?: string;
  }): Promise<RefundResult> {
    const data = await this.request<{ refund_id?: string; status?: string }>(
      'POST',
      '/v3/refund/domestic/refunds',
      {
        out_trade_no: input.outTradeNo,
        out_refund_no: input.outRefundNo,
        reason: input.reason,
        ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
        amount: { refund: input.amountInFen, total: input.amountInFen, currency: 'CNY' },
      },
    );
    if (!data.refund_id) {
      throw new BizException(90003, '微信退款失败：未返回 refund_id');
    }
    return { refundId: data.refund_id, status: data.status ?? 'PROCESSING' };
  }
}
