import { Injectable, Logger } from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';
import { WxAccessTokenService } from '../../common/wx/wx-access-token.service';
import Jimp from 'jimp';

interface SecCheckResp {
  errcode?: number;
  errmsg?: string;
  result?: { suggest?: string; label?: number };
  detail?: Array<{ strategy?: string; errcode?: number; suggest?: string; label?: number }>;
}

// img_sec_check 为 v1 接口：仅 errcode/errmsg，无 v2 的 result.suggest 结构
interface ImgSecCheckResp {
  errcode?: number;
  errmsg?: string;
}

// img_sec_check 官方限制：图片 ≤1MB、像素 ≤750x1334，仅 png/jpeg
const IMG_MAX_WIDTH = 750;
const IMG_MAX_HEIGHT = 1334;
const IMG_MAX_BYTES = 1_000_000;
const IMG_JPEG_QUALITY = 80;
const IMG_JPEG_QUALITY_FALLBACK = 60;

// 内容安全：封装微信 msgSecCheck（文本）/ imgSecCheck（图片）。
// 命中违规抛 BizException(90002)，由全局 AllExceptionsFilter 统一返回。
// 设计：文本 v2 仅 'risky' 判违规并拦截；'review'（需人工复审）只记录不拦截，留给后续 moderation 队列。
// 图片 v1：errcode 0=通过、87014=违规；其余视为不可用。
// 不可用口径（请求失败 / 非 200 / 响应非 JSON / errcode 业务错误 / 缺审核结论）：
// 生产 fail-closed 抛 90003，非生产 fail-open 仅告警——未拿到明确审核结论不默认放行。
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly wxToken: WxAccessTokenService) {}

  // 文本检测；openid 用于 v2 接口的用户维度（可为空，mock 模式忽略）
  async checkText(content: string, openid?: string): Promise<void> {
    if (!content) return;
    if (this.wxToken.isMock()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信凭证未配置，内容安全不可用');
      }
      this.logger.warn('moderation: WX credentials not set; skip text check (dev mock)');
      return;
    }
    const token = await this.wxToken.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // scene=4 社交日志（论坛/动态），符合表白墙/树洞场景
        body: JSON.stringify({ version: 2, scene: 4, openid: openid ?? '', content }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // 接口故障/响应异常时：生产 fail-closed（90003 稍后重试），非生产 fail-open + 告警。
      this.handleCheckUnavailable('msgSecCheck request failed');
      return;
    }
    if (!res.ok) {
      this.handleCheckUnavailable(`msgSecCheck HTTP ${res.status}`);
      return;
    }
    let data: SecCheckResp;
    try {
      data = (await res.json()) as SecCheckResp;
    } catch {
      this.handleCheckUnavailable('msgSecCheck invalid JSON response');
      return;
    }
    if (data.errcode !== undefined && data.errcode !== 0) {
      // HTTP 200 但微信返回业务错误（如 40001 token 失效），不得当作审核通过
      this.handleCheckUnavailable(
        `msgSecCheck errcode ${data.errcode} (${data.errmsg ?? 'no errmsg'})`,
      );
      return;
    }
    // 拿不到明确审核结论（缺 result/detail.suggest）不得默认放行（原 `?? 'pass'` fail-open 弱点已加固）
    const suggest = data.result?.suggest ?? data.detail?.[0]?.suggest;
    if (!suggest) {
      this.handleCheckUnavailable('msgSecCheck response missing suggest');
      return;
    }
    if (suggest === 'risky') {
      throw new BizException(90002, '内容包含违规信息，请修改后重试');
    }
    if (suggest === 'review') {
      this.logger.warn(`msgSecCheck review (label=${data.result?.label}); 需人工复审`);
    }
  }

  // 图片检测；传入可公网访问的图片 URL（即 COS 上传后返回的 url）。
  // wxa/img_sec_check 只收二进制（≤1MB、像素 ≤750x1334，收 URL 的是异步 mediaCheckAsync），
  // 故先下载图片并规范化到限制内再以二进制提交；v1 无 suggest 字段，违规以 errcode 87014 表达。
  async checkImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return;
    if (this.wxToken.isMock()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信凭证未配置，内容安全不可用');
      }
      this.logger.warn('moderation: WX credentials not set; skip image check (dev mock)');
      return;
    }
    const token = await this.wxToken.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`;
    let bytes: Buffer;
    try {
      bytes = await this.fetchNormalizedImage(imageUrl);
    } catch (e) {
      this.handleCheckUnavailable(
        `imgSecCheck image fetch/normalize failed: ${e instanceof Error ? e.message : 'unknown'}`,
      );
      return;
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      this.handleCheckUnavailable('imgSecCheck request failed');
      return;
    }
    if (!res.ok) {
      this.handleCheckUnavailable(`imgSecCheck HTTP ${res.status}`);
      return;
    }
    let data: ImgSecCheckResp;
    try {
      data = (await res.json()) as ImgSecCheckResp;
    } catch {
      this.handleCheckUnavailable('imgSecCheck invalid JSON response');
      return;
    }
    if (data.errcode === 87014) {
      throw new BizException(90002, '图片包含违规内容，请更换后重试');
    }
    if (data.errcode !== 0) {
      // 同 checkText：HTTP 200 业务错误/缺 errcode 不当作审核通过
      this.handleCheckUnavailable(
        `imgSecCheck errcode ${data.errcode ?? 'missing'} (${data.errmsg ?? 'no errmsg'})`,
      );
      return;
    }
  }

  // 下载图片并规范化到 img_sec_check 限制内：像素超限先 scaleToFit；格式/体积不满足时 JPEG 重编码
  private async fetchNormalizedImage(imageUrl: string): Promise<Buffer> {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      throw new Error(`image HTTP ${res.status}`);
    }
    const raw = Buffer.from(await res.arrayBuffer());
    const image = await Jimp.read(raw);
    const oversizePixels = image.getWidth() > IMG_MAX_WIDTH || image.getHeight() > IMG_MAX_HEIGHT;
    if (!oversizePixels && raw.length <= IMG_MAX_BYTES && this.isJpegOrPng(raw)) {
      return raw;
    }
    if (oversizePixels) {
      image.scaleToFit(IMG_MAX_WIDTH, IMG_MAX_HEIGHT);
    }
    let out = await image.quality(IMG_JPEG_QUALITY).getBufferAsync(Jimp.MIME_JPEG);
    if (out.length > IMG_MAX_BYTES) {
      out = await image.quality(IMG_JPEG_QUALITY_FALLBACK).getBufferAsync(Jimp.MIME_JPEG);
    }
    if (out.length > IMG_MAX_BYTES) {
      throw new Error(`image exceeds ${IMG_MAX_BYTES} bytes after normalize`);
    }
    return out;
  }

  // JPEG: FF D8 FF；PNG: 89 50 4E 47
  private isJpegOrPng(raw: Buffer): boolean {
    if (raw.length < 4) return false;
    if (raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff) return true;
    return raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47;
  }

  // 视频审核 stub：微信侧 mediaCheckAsync 为异步回调链路，P0 暂走 fail-open（仅告警不拦截）。
  // 视频封面已由 checkImage 覆盖；完整视频帧审核留 P3-06 内容安全覆盖矩阵补全。
  checkVideoStub(videoUrl: string): void {
    this.logger.warn(`video moderation stub (fail-open): ${videoUrl}; 完整视频审核待 P3-06 接入`);
  }

  private handleCheckUnavailable(reason: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(`${reason}; fail-closed`);
      throw new BizException(90003, '内容安全服务不可用，请稍后重试');
    }
    this.logger.error(`${reason}; fail-open in non-production`);
  }
}
