import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { BizException } from '../exceptions/biz.exception';

// 微信支付 V2（JSAPI 统一下单 / 回调验签 / 订单查询）封装层。
// 仅做真实调用；凭证缺失时 isReady()=false，由 PaymentService 决定 mock/real/90003。
// 金额单位：微信支付 V2 接口用「分」，入参 amountInFen 已是整数分。
//
// V2 与 V3 区别：V2 用 APIv2 密钥（32 位对称密钥）做 MD5 签名，请求/响应为 XML；
// 不需要 RSA 私钥、商户证书、平台证书（V3 才需要）。JSAPI 下单只需 appid + mch_id + APIv2密钥。
// 签名算法：参数按 key 字典序排序（剔除 sign/空值）-> k=v&...&key=APIv2密钥 -> MD5 大写。
// wx.requestPayment 的 paySign 用固定顺序：appId&timeStamp&nonceStr&package&key。

export interface WxPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string; // "prepay_id=xxx"
  signType: 'MD5';
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

// V2 回调 XML 解析后的字段（按场景取用）
export interface WxPayNotifyData {
  return_code?: string;
  result_code?: string;
  err_code?: string;
  err_code_des?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  sign?: string;
  [k: string]: string | undefined;
}

@Injectable()
export class WxPayService {
  private readonly logger = new Logger(WxPayService.name);
  private readonly appid: string;
  private readonly mchid: string;
  private readonly apiV2Key: string;
  private readonly ready: boolean;

  constructor(private readonly config: ConfigService) {
    this.appid = this.config.get<string>('WX_USER_APPID') ?? '';
    this.mchid = this.config.get<string>('WX_PAY_MCH_ID') ?? '';
    this.apiV2Key = this.config.get<string>('WX_PAY_API_V2_KEY') ?? '';
    this.ready = !!(this.appid && this.mchid && this.apiV2Key);
    if (!this.ready) {
      this.logger.warn('WX Pay V2 credentials incomplete; real pay disabled (dev mock / prod 90003)');
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

  // MD5 签名：params 剔除 sign/空值后按 key 字典序拼 k=v&...&key=apiV2Key，MD5 大写
  private signParams(params: Record<string, string | number>): string {
    const keys = Object.keys(params)
      .filter((k) => k !== 'sign' && params[k] !== '' && params[k] !== null && params[k] !== undefined)
      .sort();
    const str = keys.map((k) => `${k}=${params[k]}`).join('&') + `&key=${this.apiV2Key}`;
    return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
  }

  private nonceStr(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private buildXml(params: Record<string, string | number>): string {
    const body = Object.entries(params)
      .map(([k, v]) => `<${k}><![CDATA[${v}]]></${k}>`)
      .join('');
    return `<xml>${body}</xml>`;
  }

  // 解析 V2 扁平 XML -> { key: value }
  private parseXml(xml: string): Record<string, string> {
    const result: Record<string, string> = {};
    const regex = /<(\w+)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/\1>/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(xml)) !== null) {
      const key = m[1];
      if (key !== undefined) result[key] = m[2] ?? '';
    }
    return result;
  }

  private async postXml(url: string, params: Record<string, string | number>): Promise<Record<string, string>> {
    params.nonce_str = this.nonceStr();
    params.sign = this.signParams(params);
    const xml = this.buildXml(params);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body: xml,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BizException(90003, '微信支付请求超时或网络异常');
    }
    const text = await res.text();
    return this.parseXml(text);
  }

  // JSAPI 统一下单：返回 prepay_id + wx.requestPayment 所需签名参数
  async createJsapiOrder(input: {
    outTradeNo: string;
    amountInFen: number;
    description: string;
    openid: string;
    notifyUrl: string;
    clientIp: string;
  }): Promise<JsapiOrderResult> {
    this.ensure();
    const params: Record<string, string | number> = {
      appid: this.appid,
      mch_id: this.mchid,
      body: input.description,
      out_trade_no: input.outTradeNo,
      total_fee: input.amountInFen,
      spbill_create_ip: input.clientIp,
      notify_url: input.notifyUrl,
      trade_type: 'JSAPI',
      openid: input.openid,
    };
    const data = await this.postXml('https://api.mch.weixin.qq.com/pay/unifiedorder', params);
    if (data.return_code !== 'SUCCESS' || data.result_code !== 'SUCCESS' || !data.prepay_id) {
      throw new BizException(
        90003,
        `微信下单失败：${data.err_code_des ?? data.err_code ?? data.return_msg ?? '未知'}`,
      );
    }
    const prepayId = data.prepay_id;
    // wx.requestPayment 签名（固定顺序，signType=MD5）
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.nonceStr();
    const pkg = `prepay_id=${prepayId}`;
    const paySignStr = `appId=${this.appid}&timeStamp=${timeStamp}&nonceStr=${nonceStr}&package=${pkg}&key=${this.apiV2Key}`;
    const paySign = crypto.createHash('md5').update(paySignStr, 'utf8').digest('hex').toUpperCase();
    return {
      prepayId,
      wxPayParams: { timeStamp, nonceStr, package: pkg, signType: 'MD5', paySign },
    };
  }

  // V2 回调验签：解析 XML，校验 sign，返回字段（V2 回调是明文 XML，无需解密）
  verifyAndParseCallback(rawBody: string): WxPayNotifyData {
    this.ensure();
    const data = this.parseXml(rawBody) as WxPayNotifyData;
    if (!data.sign) throw new BizException(90003, '微信回调缺少 sign');
    const expected = this.signParams(data as Record<string, string | number>);
    if (data.sign !== expected) {
      throw new BizException(90003, '微信回调验签失败');
    }
    return data;
  }

  // 查订单状态（M6-05 兜底）：按商户单号查微信支付单状态
  async queryOrder(outTradeNo: string): Promise<OrderQueryResult> {
    this.ensure();
    const data = await this.postXml('https://api.mch.weixin.qq.com/pay/orderquery', {
      appid: this.appid,
      mch_id: this.mchid,
      out_trade_no: outTradeNo,
    });
    if (data.return_code !== 'SUCCESS' || data.result_code !== 'SUCCESS') {
      throw new BizException(90003, `微信查单失败：${data.err_code_des ?? data.err_code ?? '未知'}`);
    }
    return {
      transactionId: data.transaction_id ?? '',
      tradeState: data.trade_state ?? 'UNKNOWN',
    };
  }
}
