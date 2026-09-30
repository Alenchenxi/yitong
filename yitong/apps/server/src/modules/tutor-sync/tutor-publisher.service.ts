import { Injectable } from '@nestjs/common';
import { MerchantStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TUTOR_SYNC_CONTACT,
  TUTOR_SYNC_PUBLISHER,
} from './tutor-sync.types';

const SYSTEM_USER_ID = 'system_tutor_sync_user';
const SYSTEM_MERCHANT_ID = 'system_tutor_sync_merchant';

@Injectable()
export class TutorPublisherService {
  private readonly internalOpenid = 'internal:tutor-sync:senyang';

  constructor(private readonly prisma: PrismaService) {}

  async ensurePublisher(): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { openid: this.internalOpenid },
      update: { nickname: TUTOR_SYNC_PUBLISHER },
      create: {
        id: SYSTEM_USER_ID,
        openid: this.internalOpenid,
        nickname: TUTOR_SYNC_PUBLISHER,
      },
      select: { id: true },
    });
    await this.prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role: Role.MERCHANT } },
      update: {},
      create: { userId: user.id, role: Role.MERCHANT },
    });
    const merchant = await this.prisma.merchant.upsert({
      where: { userId: user.id },
      update: {
        shopName: TUTOR_SYNC_PUBLISHER,
        contactPhone: TUTOR_SYNC_CONTACT,
        contactWechat: TUTOR_SYNC_CONTACT,
        status: MerchantStatus.APPROVED,
      },
      create: {
        id: SYSTEM_MERCHANT_ID,
        userId: user.id,
        shopName: TUTOR_SYNC_PUBLISHER,
        licenseNo: 'INTERNAL_TUTOR_SYNC',
        contactPhone: TUTOR_SYNC_CONTACT,
        contactWechat: TUTOR_SYNC_CONTACT,
        status: MerchantStatus.APPROVED,
      },
      select: { id: true },
    });
    return merchant.id;
  }
}
