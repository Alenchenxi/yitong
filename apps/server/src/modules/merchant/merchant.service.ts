import {
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppStatus, MerchantStatus, Prisma, Role } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListCandidatesDto } from './dto/list-candidates.dto';
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

  // 商家评价列表（跨所有岗位）
  async getMerchantReviews(uid: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const posts = await this.prisma.jobPost.findMany({
      where: { merchantId: merchant.id },
      select: { id: true, title: true },
    });
    const postMap = new Map(posts.map((p) => [p.id, p.title]));
    if (posts.length === 0) return [];

    const reviews = await this.prisma.jobReview.findMany({
      where: { application: { jobPostId: { in: posts.map((p) => p.id) } } },
      orderBy: { createdAt: 'desc' },
      include: {
        application: {
          select: { userId: true, user: { select: { nickname: true } }, jobPostId: true },
        },
      },
    });
    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      jobPostTitle: postMap.get(r.application.jobPostId) ?? '',
      reviewerNickname: r.application.user?.nickname ?? '',
    }));
  }

  // M2-01 跨岗位候选人聚合：商家按岗位 / 状态 / 关键词分页查询自己所有岗位的报名候选人
  async listCandidates(uid: string, dto: ListCandidatesDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const keyword = dto.keyword?.trim();
    const where: Prisma.JobApplicationWhereInput = {
      jobPost: { merchantId: merchant.id },
      ...(dto.jobPostId ? { jobPostId: dto.jobPostId } : {}),
      ...(dto.status ? { status: dto.status as AppStatus } : {}),
      ...(keyword
        ? {
            OR: [
              { user: { nickname: { contains: keyword, mode: 'insensitive' } } },
              { jobPost: { title: { contains: keyword, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const [total, apps] = await Promise.all([
      this.prisma.jobApplication.count({ where }),
      this.prisma.jobApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { nickname: true } },
          jobPost: { select: { title: true } },
        },
      }),
    ]);

    // 简历快照（与 job.service listApplications 同口径：name/phone/selfIntro/skills）
    const resumeIds = [...new Set(apps.map((a) => a.resumeId).filter((id): id is string => !!id))];
    const resumes =
      resumeIds.length > 0
        ? await this.prisma.resume.findMany({
            where: { id: { in: resumeIds } },
            select: { id: true, name: true, phone: true, selfIntro: true, skills: true },
          })
        : [];
    const resumeMap = new Map(resumes.map((r) => [r.id, r]));

    return {
      list: apps.map((a) => {
        const resume = a.resumeId ? (resumeMap.get(a.resumeId) ?? null) : null;
        return {
          id: a.id,
          jobPostId: a.jobPostId,
          jobPostTitle: a.jobPost?.title ?? '',
          userId: a.userId,
          userNickname: a.user?.nickname ?? '',
          resumeId: a.resumeId,
          resume: resume
            ? { name: resume.name, phone: resume.phone, selfIntro: resume.selfIntro, skills: resume.skills }
            : null,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  // 商家订单记录（付费发布历史）
  async getMerchantOrders(uid: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);

    const [orders, posts] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where: { merchantId: merchant.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jobPost.findMany({
        where: { merchantId: merchant.id },
        select: { id: true, title: true },
      }),
    ]);
    const postMap = new Map(posts.map((p) => [p.id, p.title]));
    return orders.map((o) => ({
      id: o.id,
      jobPostId: o.jobPostId,
      jobPostTitle: postMap.get(o.jobPostId) ?? '',
      duration: o.duration,
      amount: o.amount.toString(),
      status: o.status,
      paidAt: o.paidAt?.toISOString() ?? null,
      refundedAt: o.refundedAt?.toISOString() ?? null,
      refundReason: o.refundReason,
      createdAt: o.createdAt.toISOString(),
    }));
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
