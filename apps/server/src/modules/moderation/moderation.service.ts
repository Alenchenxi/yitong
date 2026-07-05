import { Injectable, Logger } from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';
import { WxAccessTokenService } from '../../common/wx/wx-access-token.service';

interface SecCheckResp {
  errcode?: number;
  errmsg?: string;
  result?: { suggest?: string; label?: number };
  detail?: Array<{ strategy?: string; errcode?: number; suggest?: string; label?: number }>;
}

// 内容安全：封装微信 msgSecCheck（文本）/ imgSecCheck（图片）。
// 命中违规抛 BizException(90002)，由全局 AllExceptionsFilter 统一返回。
// 设计：仅 'risky' 判违规并拦截；'review'（需人工复审）只记录不拦截，留给后续 moderation 队列。
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private readonly wxToken: WxAccessTokenService) {}

  // 文本检测；openid 用于 v2 接口的用户维度（可为空，mock 模式忽略）
  async checkText(content: string, openid?: string): Promise<void> {
    if (!content) return;
    if (this.wxToken.isMock()) {
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
      // 内容安全接口故障时「失败放行 + 告警」，避免微信侧抖动导致全员无法发帖；
      // 生产化后可改为可配置 fail-open/fail-closed（见后续待做）。
      this.logger.error('msgSecCheck request failed; fail-open');
      return;
    }
    if (!res.ok) {
      this.logger.error(`msgSecCheck HTTP ${res.status}; fail-open`);
      return;
    }
    const data = (await res.json()) as SecCheckResp;
    const suggest = data.result?.suggest ?? data.detail?.[0]?.suggest ?? 'pass';
    if (suggest === 'risky') {
      throw new BizException(90002, '内容包含违规信息，请修改后重试');
    }
    if (suggest === 'review') {
      this.logger.warn(`msgSecCheck review (label=${data.result?.label}); 需人工复审`);
    }
  }

  // 图片检测；传入可公网访问的图片 URL（即 COS 上传后返回的 url）
  async checkImage(imageUrl: string): Promise<void> {
    if (!imageUrl) return;
    if (this.wxToken.isMock()) {
      this.logger.warn('moderation: WX credentials not set; skip image check (dev mock)');
      return;
    }
    const token = await this.wxToken.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_url: imageUrl, media_type: 2 }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      this.logger.error('imgSecCheck request failed; fail-open');
      return;
    }
    if (!res.ok) {
      this.logger.error(`imgSecCheck HTTP ${res.status}; fail-open`);
      return;
    }
    const data = (await res.json()) as SecCheckResp;
    const suggest = data.result?.suggest ?? 'pass';
    if (suggest === 'risky') {
      throw new BizException(90002, '图片包含违规内容，请更换后重试');
    }
    if (suggest === 'review') {
      this.logger.warn(`imgSecCheck review (label=${data.result?.label}); 需人工复审`);
    }
  }
}
