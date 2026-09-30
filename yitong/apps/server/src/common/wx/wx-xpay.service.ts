import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { BizException } from '../exceptions/biz.exception';
import { WxAccessTokenService } from './wx-access-token.service';

// 微信小程序虚拟支付（道具直购）协议层。与 wx-pay.service.ts（V3 商户 API）完全独立：
//   - 凭证：MP 后台「虚拟支付 -> 基础配置」的 OfferID + 沙箱/现网 AppKey（按 WX_XPAY_ENV 取一套）
//   - 前端拉起：wx.requestVirtualPayment({ signData, paySig, signature, mode: 'short_series_goods' })
//   - 签名：HMAC-SHA256 对称签名（V3 是 RSA 证书签名）
//       paySig    = HMAC(AppKey,  "requestVirtualPayment&" + signData)   // uri 固定，& 不可漏
//       signature = HMAC(session_key, signData)                          // 用户态签名
//   - 服务端 API：api.weixin.qq.com/xpay/*，query 带 access_token + pay_sig = HMAC(AppKey, uri + '&' + body)
// 关键坑（官方文档 §2.5 + 实测）：signData key 必须字母序、offerId 必须字符串（前端原样透传不可重新序列化）；
// 沙箱环境（env=1）不推送 xpay_goods_deliver_notify 发货回调，靠前端支付成功后 sync 兜底对账。
// Apple 支付不支持沙箱，iOS 真机只能现网（env=0）。

// wx.requestVirtualPayment 所需参数（后端算好，前端原样透传）
export interface VirtualPayParams {
  signData: string;
  paySig: string;
  signature: string;
  mode: string; // 道具直购固定 'short_series_goods'
}

// /xpay/query_order 返回的 order 字段（status 枚举见官方文档）
export interface XpayOrderInfo {
  order_id?: string;
  // 1 创建成功 / 2 已支付待发货 / 3 发货中 / 4 已发货 / 5 已退款 / 6 已关闭 / 7 退款失败 / 8 用户退款完成
  status?: number;
  order_fee?: number;
  paid_fee?: number;
  left_fee?: number; // 剩余可退金额（分），refund_order 必须传且与微信侧一致
  paid_time?: number;
  wx_order_id?: string;
  wxpay_order_id?: string;
  [k: string]: unknown;
}

@Injectable()
export class WxXPayService {
  private readonly logger = new Logger(WxXPayService.name);
  private readonly offerId: string;
  private readonly env: 0 | 1;
  private readonly appKey: string;
  private readonly ready: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly accessToken: WxAccessTokenService,
  ) {
    this.offerId = this.config.get<string>('WX_XPAY_OFFER_ID') ?? '';
    this.env = Number(this.config.get<string>('WX_XPAY_ENV') ?? '0') === 1 ? 1 : 0;
    // 按环境取对应 AppKey：env=0 现网 / env=1 沙箱，签名密钥两套不可混用
    this.appKey =
      this.env === 1
        ? (this.config.get<string>('WX_XPAY_SANDBOX_APP_KEY') ?? '')
        : (this.config.get<string>('WX_XPAY_APP_KEY') ?? '');
    this.ready = !!(this.offerId && this.appKey);
    if (!this.ready) {
      this.logger.warn('WX XPAY credentials incomplete; virtual pay disabled (dev mock / prod 90003)');
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private ensure(): void {
    if (!this.ready) {
      throw new BizException(90003, '微信虚拟支付凭证未配置');
    }
  }

  private hmacSha256(key: string, message: string): string {
    return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
  }

  // 构建拉起支付三要素。signData key 严格字母序（微信验签对顺序敏感），offerId 必须字符串。
  buildGoodsPayParams(input: {
    outTradeNo: string;
    goodsPriceFen: number;
    productId: string;
    sessionKey: string;
  }): VirtualPayParams {
    const signData = JSON.stringify({
      buyQuantity: 1,
      currencyType: 'CNY',
      env: this.env,
      goodsPrice: input.goodsPriceFen,
      offerId: this.offerId,
      outTradeNo: input.outTradeNo,
      productId: input.productId,
    });
    return {
      signData,
      paySig: this.hmacSha256(this.appKey, `requestVirtualPayment&${signData}`),
      signature: this.hmacSha256(input.sessionKey, signData),
      mode: 'short_series_goods',
    };
  }

  // xpay 服务端 API 统一请求：POST uri?access_token=..&pay_sig=..，pay_sig = HMAC(AppKey, uri + '&' + body)
  private async request(uri: string, body: string): Promise<Record<string, unknown>> {
    this.ensure();
    const token = await this.accessToken.getAccessToken();
    const paySig = this.hmacSha256(this.appKey, `${uri}&${body}`);
    let res: Response;
    try {
      res = await fetch(
        `https://api.weixin.qq.com${uri}?access_token=${encodeURIComponent(token)}&pay_sig=${paySig}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch {
      throw new BizException(90003, '微信虚拟支付请求超时或网络异常');
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const errcode = typeof data.errcode === 'number' ? data.errcode : 0;
    if (!res.ok || errcode !== 0) {
      throw new BizException(
        90003,
        `微信虚拟支付接口失败：${String(data.errmsg ?? data.errcode ?? `HTTP ${res.status}`)}`,
      );
    }
    return data;
  }

  // 查询现金单：body 需 openid + env + order_id，left_fee/wx_order_id 供退款与对账使用
  async queryOrder(input: { outTradeNo: string; openid: string }): Promise<XpayOrderInfo> {
    const body = JSON.stringify({
      env: this.env,
      openid: input.openid,
      order_id: input.outTradeNo,
    });
    const data = await this.request('/xpay/query_order', body);
    return (data.order ?? {}) as XpayOrderInfo;
  }

  // 发货确认：沙箱/推送丢失时主动把订单推到「已发货」，避免停在待发货
  async notifyProvideGoods(input: { outTradeNo: string; openid: string }): Promise<boolean> {
    const info = await this.queryOrder(input);
    const wxOrderId = typeof info.wx_order_id === 'string' ? info.wx_order_id : '';
    if (!wxOrderId) {
      this.logger.warn(`notifyProvideGoods: order ${input.outTradeNo} 缺少 wx_order_id，跳过`);
      return false;
    }
    const body = JSON.stringify({
      env: this.env,
      openid: input.openid,
      order_id: input.outTradeNo,
      wx_order_id: wxOrderId,
    });
    await this.request('/xpay/notify_provide_goods', body);
    return true;
  }

  // 启动退款任务（仅启动，最终态由 xpay_refund_notify 推送或定时轮询 query_order 确认）。
  // left_fee 必须取自 query_order（不一致报 268490016）；refund_reason/req_from 为官方枚举值字符串。
  async refundOrder(input: {
    outTradeNo: string;
    openid: string;
    leftFeeFen: number;
    refundFeeFen: number;
    refundOrderNo: string; // 8~32 位字母数字 _ -，如 `${orderId}_R1`
    reasonCode: '0' | '1' | '2' | '3' | '4' | '5'; // 3=意愿问题（用户主动退款）
    reqFrom: '1' | '2' | '3'; // 2=用户自己发起 / 3=其它（自动退款）
  }): Promise<{ refundOrderId: string }> {
    const body = JSON.stringify({
      biz_meta: '',
      env: this.env,
      left_fee: input.leftFeeFen,
      openid: input.openid,
      order_id: input.outTradeNo,
      refund_fee: input.refundFeeFen,
      refund_order_id: input.refundOrderNo,
      refund_reason: input.reasonCode,
      req_from: input.reqFrom,
    });
    const data = await this.request('/xpay/refund_order', body);
    return {
      refundOrderId: typeof data.refund_order_id === 'string' ? data.refund_order_id : '',
    };
  }

  // ===== 道具批量上传/发布（改价自动同步用，官方无道具读取/修改/删除 API，只能新增+发布）=====

  // 启动上传道具任务（一次仅支持一个道具）。item_url 必填（jpg/png 公网图片，微信会转存）。
  async startUploadGoods(item: {
    id: string;
    name: string;
    priceFen: number;
    remark: string;
    itemUrl: string;
  }): Promise<void> {
    const body = JSON.stringify({
      upload_item: [
        {
          id: item.id,
          name: item.name,
          price: item.priceFen,
          remark: item.remark,
          item_url: item.itemUrl,
        },
      ],
      env: this.env,
    });
    await this.request('/xpay/start_upload_goods', body);
  }

  // 查询上传任务：status 0-无任务 1-运行中 2-失败或部分失败 3-成功；
  // upload_status 0-上传中 1-id已存在 2-上传成功 3-上传失败
  async queryUploadGoods(): Promise<{
    status: number;
    items: Array<{ id: string; uploadStatus: number; errmsg?: string }>;
  }> {
    const data = await this.request('/xpay/query_upload_goods', JSON.stringify({ env: this.env }));
    const items = Array.isArray(data.upload_item) ? data.upload_item : [];
    return {
      status: typeof data.status === 'number' ? data.status : 0,
      items: items.map((it) => {
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === 'string' ? o.id : '',
          uploadStatus: typeof o.upload_status === 'number' ? o.upload_status : -1,
          errmsg: typeof o.errmsg === 'string' ? o.errmsg : undefined,
        };
      }),
    };
  }

  // 启动发布道具任务（上传成功/id已存在后调用，一次一个）
  async startPublishGoods(id: string): Promise<void> {
    const body = JSON.stringify({
      publish_item: [{ id }],
      env: this.env,
    });
    await this.request('/xpay/start_publish_goods', body);
  }

  // 查询发布任务：status 0-无任务 1-运行中 2-失败或部分失败 3-成功；
  // publish_status 0-发布中 1-id已存在 2-发布成功 3-发布失败
  async queryPublishGoods(): Promise<{
    status: number;
    items: Array<{ id: string; publishStatus: number; errmsg?: string }>;
  }> {
    const data = await this.request('/xpay/query_publish_goods', JSON.stringify({ env: this.env }));
    const items = Array.isArray(data.publish_item) ? data.publish_item : [];
    return {
      status: typeof data.status === 'number' ? data.status : 0,
      items: items.map((it) => {
        const o = it as Record<string, unknown>;
        return {
          id: typeof o.id === 'string' ? o.id : '',
          publishStatus: typeof o.publish_status === 'number' ? o.publish_status : -1,
          errmsg: typeof o.errmsg === 'string' ? o.errmsg : undefined,
        };
      }),
    };
  }
}
