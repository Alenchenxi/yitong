import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MerchantStatus, Role, type User } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload, WxSessionResult } from './types';
import type { WxLoginDto } from './dto/wx-login.dto';

const ACCESS_EXPIRES = '2h';
const REFRESH_EXPIRES = '7d';

// DTO 小写 role -> Prisma enum Role
const ROLE_MAP: Record<string, Role> = {
  user: Role.USER,
  merchant: Role.MERCHANT,
  admin: Role.ADMIN,
};

type RoleKey = 'user' | 'merchant' | 'admin';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async wxLogin(dto: WxLoginDto) {
    const wx = await this.code2session(dto.code);
    if (wx.errcode) {
      throw new BizException(10004, `微信登录失败: ${wx.errmsg ?? '未知错误'}`);
    }
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
    // 封禁检查（soft delete）
    if (user.deletedAt) {
      throw new BizException(10005, '账号已被封禁', HttpStatus.FORBIDDEN);
    }
    const role = await this.ensureRole(user.id, dto.role, wx.openid);
    return this.issueTokens(user, role);
  }

  // 静默切换角色：已登录用户（uid）切换到 newRole，不需重新 wx.login
  async switchRole(uid: string, roleKey: RoleKey) {
    const user = await this.prisma.user.findUnique({ where: { id: uid } });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.UNAUTHORIZED);
    const role = await this.ensureRole(uid, roleKey, user.openid);
    return this.issueTokens(user, role);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new BizException(10002, 'refreshToken 无效', HttpStatus.UNAUTHORIZED);
    }
    if (payload.type !== 'refresh') {
      throw new BizException(10002, 'token 类型不正确', HttpStatus.UNAUTHORIZED);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.UNAUTHORIZED);
    // 刷新时沿用原 role
    return this.issueTokens(user, payload.role as Role);
  }

  async getMe(uid: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      include: { userRoles: { select: { role: true } } },
    });
    if (!user) throw new BizException(10001, '用户不存在', HttpStatus.UNAUTHORIZED);
    return this.toUserVo(user);
  }

  // 校验并确保用户拥有目标角色：管理员需 openid 预设绑定；user/merchant 默认放宽（merchant 生产由 feat/merchant 收紧）
  private async ensureRole(
    uid: string,
    roleKey: RoleKey,
    openid: string,
  ): Promise<Role> {
    const role = ROLE_MAP[roleKey];
    if (!role) throw new BizException(10004, '角色不合法');

    if (role === Role.ADMIN) {
      const admin = await this.prisma.adminUser.findFirst({ where: { openid } });
      if (!admin) {
        throw new BizException(
          10003,
          '该微信号未绑定管理员，无权以管理员身份登录',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    if (role === Role.MERCHANT) {
      // 商家角色需 Merchant 审核通过（入驻由 feat/merchant，审核由 feat/admin）
      const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
      if (!m || m.status !== MerchantStatus.APPROVED) {
        throw new BizException(
          60003,
          '未入驻或商家资质未审核通过，无权以商家身份登录',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // 确保 UserRole 存在该角色（幂等）
    await this.prisma.userRole.upsert({
      where: { userId_role: { userId: uid, role } },
      update: {},
      create: { userId: uid, role },
    });
    return role;
  }

  private async issueTokens(user: User, role: Role) {
    const base: JwtPayload = { uid: user.id, role, openid: user.openid };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync({ ...base, type: 'access' }, { expiresIn: ACCESS_EXPIRES }),
      this.jwt.signAsync({ ...base, type: 'refresh' }, { expiresIn: REFRESH_EXPIRES }),
    ]);
    return { accessToken, refreshToken, user: await this.toUserVo(user), role };
  }

  private async toUserVo(
    user: User & { userRoles?: { role: Role }[] },
  ) {
    let roles = user.userRoles?.map((r) => r.role) ?? [];
    if (roles.length === 0) {
      const found = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        select: { role: true },
      });
      roles = found.map((r) => r.role);
    }
    return {
      id: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      roles,
    };
  }

  // 微信 code2session：三端合一为单一个小程序，统一用 WX_USER_APPID/SECRET
  private async code2session(code: string): Promise<WxSessionResult> {
    const appid = this.config.get<string>('WX_USER_APPID');
    const secret = this.config.get<string>('WX_USER_SECRET');
    if (!appid || !secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(10004, '微信凭证未配置');
      }
      this.logger.warn('WX credentials not set; using mock code2session for dev');
      return {
        // mock 模式：openid = mock_<code 前8位>；测试管理员用 code='admin' -> 'mock_admin'（匹配种子）
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
