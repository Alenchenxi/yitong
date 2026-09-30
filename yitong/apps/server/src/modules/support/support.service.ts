import { HttpStatus, Injectable } from '@nestjs/common';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  // P2-20 创建工单
  async createTicket(uid: string, role: 'user' | 'merchant', title: string, content: string) {
    const t = title?.trim() ?? '';
    const c = content?.trim() ?? '';
    if (!t || t.length > 100) throw new BizException(20003, '标题无效（1-100 字）', HttpStatus.BAD_REQUEST);
    if (!c || c.length > 2000) throw new BizException(20003, '内容无效（1-2000 字）', HttpStatus.BAD_REQUEST);
    return this.prisma.supportTicket.create({ data: { userId: uid, role, title: t, content: c } });
  }

  // 我的工单
  async listMyTickets(uid: string) {
    const list = await this.prisma.supportTicket.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return list.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      reply: t.reply,
      createdAt: t.createdAt.toISOString(),
      repliedAt: t.repliedAt?.toISOString() ?? null,
    }));
  }

  async getTicket(uid: string, id: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t || t.userId !== uid) throw new BizException(20003, '工单不存在', HttpStatus.NOT_FOUND);
    return t;
  }

  // P2-19 薪资保障规则（文档化版，前端可拉取展示）
  getSalaryGuaranteeRules() {
    return {
      version: 'v1',
      rules: [
        '所有兼职岗位须明确实时薪/日薪/月薪，禁止"面议"模糊描述',
        '日结/周结岗位：薪资须在约定周期内自动结算，逾期平台介入',
        '薪资保障：商家发布岗位前需完成资质审核（MerchantStatus=APPROVED）',
        '学生入职前可在【我的报名】查看岗位薪资、工作时间、结算方式',
        '遇到拖欠薪资：可在岗位详情使用【投诉商家】功能，平台 24 小时内介入',
        '薪资争议期间，平台可冻结商家该岗位招聘权限直至处理完毕',
        '学生完成工作后未按时收到薪资：保留聊天/打卡/工作量截图作为证据',
      ],
      contact: '客服工单入口（POST /support/tickets）或反馈邮箱 support@yitong.example',
    };
  }

  // P2-17 商家账单列表（复用 PaymentOrder）
  async listMerchantOrders(uid: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: uid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    const orders = await this.prisma.paymentOrder.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const postIds = orders.map((o) => o.jobPostId).filter((x): x is string => !!x);
    const posts = postIds.length
      ? await this.prisma.jobPost.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } })
      : [];
    const titleMap = new Map(posts.map((p) => [p.id, p.title]));
    return orders.map((o) => ({
      id: o.id,
      amount: o.amount.toString(),
      status: o.status,
      duration: o.duration,
      jobPostTitle: titleMap.get(o.jobPostId ?? '') ?? '',
      paidAt: o.paidAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    }));
  }
}
