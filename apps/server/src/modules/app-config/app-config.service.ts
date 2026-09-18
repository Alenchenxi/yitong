import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const ANONYMOUS_CONTENT_ENABLED_KEY = 'content.anonymous_enabled';
export const JOB_MODULE_ENABLED_KEY = 'job.enabled';
export const MERCHANT_REVIEW_ENABLED_KEY = 'merchant.need_review';

export interface AnonymousContentVisibility {
  anonymousContentEnabled: boolean;
}

export interface JobModuleVisibility {
  jobEnabled: boolean;
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
   * 用户端兼职板块开关：与匿名内容开关同策略，缺省关闭（config?.value === true 才视为开启），
   * 旧数据库未执行 seed 时也保持隐藏，由管理端按运营需要开启。
   */
  async getJobModuleVisibility(): Promise<JobModuleVisibility> {
    const config = await this.prisma.appConfig.findUnique({
      where: { key: JOB_MODULE_ENABLED_KEY },
      select: { value: true },
    });

    return { jobEnabled: config?.value === true };
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
