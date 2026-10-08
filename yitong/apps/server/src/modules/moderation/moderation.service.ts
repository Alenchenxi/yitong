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
// 不可用口径（请求失败 / 非 200 / 响应非 JSON / errcode 业务错误 / 缺 suggest）：
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

  // 图片检测；传入可公网访问的图片 URL（即 COS 上传后返回的 url）
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
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_url: imageUrl, media_type: 2 }),
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
    let data: SecCheckResp;
    try {
      data = (await res.json()) as SecCheckResp;
    } catch {
      this.handleCheckUnavailable('imgSecCheck invalid JSON response');
      return;
    }
    if (data.errcode !== undefined && data.errcode !== 0) {
      // 同 checkText：HTTP 200 业务错误不当作审核通过
      this.handleCheckUnavailable(
        `imgSecCheck errcode ${data.errcode} (${data.errmsg ?? 'no errmsg'})`,
      );
      return;
    }
    // 同 checkText：缺审核结论不默认放行
    const suggest = data.result?.suggest;
    if (!suggest) {
      this.handleCheckUnavailable('imgSecCheck response missing suggest');
      return;
    }
    if (suggest === 'risky') {
      throw new BizException(90002, '图片包含违规内容，请更换后重试');
    }
    if (suggest === 'review') {
      this.logger.warn(`imgSecCheck review (label=${data.result?.label}); 需人工复审`);
    }
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
