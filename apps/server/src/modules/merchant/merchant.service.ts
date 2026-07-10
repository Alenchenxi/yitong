import {
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { MerchantStatus, Role } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterMerchantDto } from './dto/register-merchant.dto';
import type { UpdateMerchantDto } from './dto/update-merchant.dto';

// 错误码 6xxxx 商家段（API 规范 §3 未列，新增）：60001 已入驻 / 60002 未入驻 / 60003 未审核通过
@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 入驻：创建 Merchant(PENDING)。dev 模式自动审核通过 + 加 MERCHANT 角色（方便测试）；
  // 生产等 feat/admin 审核（approveInternal 由 admin 调用）。
  async register(uid: string, dto: RegisterMerchantDto) {
    const existing = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (existing) throw new BizException(60001, '已入驻，不能重复申请');
    const m = await this.prisma.merchant.create({
      data: {
        userId: uid,
        shopName: dto.shopName,
        licenseNo: dto.licenseNo,
        contactPhone: dto.contactPhone,
        status: MerchantStatus.PENDING,
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn('dev mode: auto-approve merchant + grant MERCHANT role');
      await this.approveInternal(uid);
    }
    const refreshed = await this.prisma.merchant.findUnique({ where: { id: m.id } });
    return this.toVo(refreshed!);
  }

  async getProfile(uid: string) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    return this.toVo(m);
  }

  async updateProfile(uid: string, dto: UpdateMerchantDto) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.merchant.update({
      where: { userId: uid },
      data: {
        ...(dto.shopName ? { shopName: dto.shopName } : {}),
        ...(dto.contactPhone ? { contactPhone: dto.contactPhone } : {}),
      },
    });
    return this.toVo(updated);
  }

  // 审核通过 helper：置 APPROVED + 给用户加 MERCHANT 角色。供 feat/admin 调用。
  async approveInternal(uid: string) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) return;
    if (m.status !== MerchantStatus.APPROVED) {
      await this.prisma.merchant.update({
        where: { id: m.id },
        data: { status: MerchantStatus.APPROVED },
      });
    }
    await this.prisma.userRole.upsert({
      where: { userId_role: { userId: uid, role: Role.MERCHANT } },
      update: {},
      create: { userId: uid, role: Role.MERCHANT },
    });
  }

  async rejectInternal(uid: string, _reason?: string) {
    const m = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!m) return;
    await this.prisma.merchant.update({
      where: { id: m.id },
      data: { status: MerchantStatus.REJECTED },
    });
    // 拒绝则移除 MERCHANT 角色
    await this.prisma.userRole.deleteMany({
      where: { userId: uid, role: Role.MERCHANT },
    });
  }

  private toVo(m: {
    id: string;
    userId: string;
    shopName: string;
    licenseNo: string;
    contactPhone: string;
    status: MerchantStatus;
    createdAt: Date;
  }) {
    return {
      id: m.id,
      userId: m.userId,
      shopName: m.shopName,
      licenseNo: m.licenseNo,
      contactPhone: m.contactPhone,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
