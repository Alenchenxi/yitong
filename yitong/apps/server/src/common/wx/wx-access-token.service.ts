import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BizException } from '../exceptions/biz.exception';

interface WxTokenResp {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

// 微信平台级 access_token（用于 msgSecCheck / imgSecCheck 等内容安全接口）。
// 与 code2session 返回的 session_key 不同：access_token 是稳定凭证，需服务端缓存复用，
// 否则高频调用会撞微信接口的 gettoken 限额（同一 AppID 每日次数有限）。
@Injectable()
export class WxAccessTokenService {
  private readonly logger = new Logger(WxAccessTokenService.name);
  private token: string | null = null;
  private expiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  // 是否缺少真实微信凭证（开发态走 mock）
  isMock(): boolean {
    return (
      !this.config.get<string>('WX_USER_APPID') ||
      !this.config.get<string>('WX_USER_SECRET')
    );
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.expiresAt) return this.token;

    const appid = this.config.get<string>('WX_USER_APPID');
    const secret = this.config.get<string>('WX_USER_SECRET');
    if (!appid || !secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信凭证未配置，内容安全不可用');
      }
      this.logger.warn('WX credentials not set; using mock access_token for dev');
      return 'mock-access-token';
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new BizException(90003, '微信 access_token 获取失败，请稍后重试');
    }
    if (!res.ok) {
      throw new BizException(90003, `微信 access_token 获取失败: HTTP ${res.status}`);
    }
    const data = (await res.json()) as WxTokenResp;
    if (!data.access_token) {
      throw new BizException(
        90003,
        `微信 access_token 获取失败: ${data.errmsg ?? data.errcode ?? '未知错误'}`,
      );
    }
    // 提前 60s 过期，避免边界处用过期 token
    this.token = data.access_token;
    this.expiresAt = now + (data.expires_in ?? 7200) * 1000 - 60_000;
    return this.token;
  }
}
