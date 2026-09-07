import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const ANONYMOUS_CONTENT_ENABLED_KEY = 'content.anonymous_enabled';
export const MERCHANT_REVIEW_ENABLED_KEY = 'merchant.need_review';

export interface AnonymousContentVisibility {
  anonymousContentEnabled: boolean;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnonymousContentVisibility(): Promise<AnonymousContentVisibility> {
    const config = await this.prisma.appConfig.findUnique({
      where: { key: ANONYMOUS_CONTENT_ENABLED_KEY },
      select: { value: true },
    });

    return { anonymousContentEnabled: config?.value === true };
  }

  /**
   * 商家入驻审核开关：只把显式 false 视为关闭。
   * 这样旧数据库尚未执行 seed 时仍保持历史生产行为（需要审核）。
   */
  async isMerchantReviewEnabled(): Promise<boolean> {
    const config = await this.prisma.appConfig.findUnique({
      where: { key: MERCHANT_REVIEW_ENABLED_KEY },
      select: { value: true },
    });
    return config?.value !== false;
  }
}
