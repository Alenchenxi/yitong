import { HttpStatus, Injectable } from '@nestjs/common';
import { CommunityStatus } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { WxAccessTokenService } from '../../common/wx/wx-access-token.service';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 10 * 60 * 1000;

export interface CommunityInviteCodeVo {
  communityId: string;
  imageBase64: string;
  mimeType: 'image/png';
}

@Injectable()
export class CommunityInviteCodeService {
  private readonly cache = new Map<string, { expiresAt: number; imageBase64: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wxAccessToken: WxAccessTokenService,
  ) {}

  async generate(uid: string, communityId: string): Promise<CommunityInviteCodeVo> {
    const community = await this.prisma.community.findFirst({
      where: { id: communityId, status: CommunityStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!community) throw new BizException(80010, '圈子不存在或已停用', HttpStatus.NOT_FOUND);

    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: uid } },
      select: { id: true },
    });
    if (!member) throw new BizException(10003, '只有圈友可以生成邀请二维码', HttpStatus.FORBIDDEN);

    const cached = this.cache.get(communityId);
    if (cached && cached.expiresAt > Date.now()) {
      return { communityId, imageBase64: cached.imageBase64, mimeType: 'image/png' };
    }

    const token = await this.wxAccessToken.getAccessToken();
    let response: Response;
    try {
      response = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scene: communityId,
          page: 'pages/square/index',
          check_path: false,
          env_version: 'release',
          width: 430,
          auto_color: false,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BizException(90003, '微信小程序码生成失败，请稍后重试', HttpStatus.BAD_GATEWAY);
    }
    if (!response.ok) {
      throw new BizException(90003, `微信小程序码生成失败: HTTP ${response.status}`, HttpStatus.BAD_GATEWAY);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!contentType.includes('image/') || buffer.length < 100) {
      let message = '微信小程序码生成失败';
      try {
        const payload = JSON.parse(buffer.toString('utf8')) as { errmsg?: string; errcode?: number };
        if (payload.errmsg) message += `: ${payload.errmsg}`;
      } catch {
        // 微信异常响应不是 JSON 时保留通用错误文案。
      }
      throw new BizException(90003, message, HttpStatus.BAD_GATEWAY);
    }

    const imageBase64 = buffer.toString('base64');
    this.cache.set(communityId, { expiresAt: Date.now() + CACHE_TTL_MS, imageBase64 });
    return { communityId, imageBase64, mimeType: 'image/png' };
  }
}