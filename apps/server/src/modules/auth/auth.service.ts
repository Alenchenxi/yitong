import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, WxSessionResult } from './types';
import type { WxLoginDto } from './dto/wx-login.dto';

const ACCESS_EXPIRES = '2h';
const REFRESH_EXPIRES = '7d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async wxLogin(dto: WxLoginDto) {
    const creds = this.getWxCreds(dto.role);
    const wx = await this.code2session(creds.appid, creds.secret, dto.code);
    if (wx.errcode) {
      throw new BizException(10004, `微信登录失败: ${wx.errmsg ?? '未知错误'}`);
    }

    // dto.role 仅用于选择对应小程序的 AppID/Secret，不写入用户角色；
    // 用户角色默认 USER，商家身份经 Merchant 表关联表达（见 schema.prisma）
    const user = await this.prisma.user.upsert({
      where: { openid: wx.openid },
      create: {
        openid: wx.openid,
        unionid: wx.unionid ?? null,
        nickname: dto.nickname ?? `用户${wx.openid.slice(-6)}`,
        avatarUrl: dto.avatarUrl ?? null,
      },
      update: {
        ...(dto.nickname ? { nickname: dto.nickname } : {}),
        ...(dto.avatarUrl ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new BizException(10002, 'refreshToken 无效', HttpStatus.UNAUTHORIZED);
    }
    // 仅允许 refresh token 刷新，禁止 access token 互换使用
    if (payload.type !== 'refresh') {
      throw new BizException(10002, 'token 类型不正确', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.UNAUTHORIZED);
    return this.issueTokens(user);
  }

  async getMe(uid: string) {
    const user = await this.prisma.user.findUnique({ where: { id: uid } });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.UNAUTHORIZED);
    return this.toUserVo(user);
  }

  private async issueTokens(user: User) {
    const base: JwtPayload = { uid: user.id, role: user.role, openid: user.openid };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...base, type: 'access' }, { expiresIn: ACCESS_EXPIRES }),
      this.jwt.signAsync({ ...base, type: 'refresh' }, { expiresIn: REFRESH_EXPIRES }),
    ]);
    return { accessToken, refreshToken, user: this.toUserVo(user) };
  }

  private toUserVo(user: User) {
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }

  private getWxCreds(role: 'user' | 'merchant') {
    if (role === 'merchant') {
      return {
        appid: this.config.get<string>('WX_MERCHANT_APPID'),
        secret: this.config.get<string>('WX_MERCHANT_SECRET'),
      };
    }
    return {
      appid: this.config.get<string>('WX_USER_APPID'),
      secret: this.config.get<string>('WX_USER_SECRET'),
    };
  }

  // 微信 code2session：开发环境未配置凭证时返回 mock openid，便于本地联调
  private async code2session(
    appid: string | undefined,
    secret: string | undefined,
    code: string,
  ): Promise<WxSessionResult> {
    if (!appid || !secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(10004, '微信凭证未配置');
      }
      this.logger.warn('WX credentials not set; using mock code2session for dev');
      return {
        openid: `mock_${code.slice(0, 8)}`,
        session_key: '',
        unionid: null,
        errcode: 0,
        errmsg: '',
      };
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new BizException(10004, '微信接口请求失败，请稍后重试');
    }
    if (!res.ok) {
      throw new BizException(10004, `微信接口请求失败: HTTP ${res.status}`);
    }
    return (await res.json()) as WxSessionResult;
  }
}
