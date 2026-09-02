import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const ANONYMOUS_CONTENT_ENABLED_KEY = 'content.anonymous_enabled';

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
}
