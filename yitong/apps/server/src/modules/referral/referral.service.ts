import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

// 错误码 8xxxx 拉新段：80001 邀请码无效 / 80002 不能邀请自己 / 80003 已被记录邀请
// 邀请码生成：6 位大写字母数字（去易混 O/0/I/1），碰撞重试
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_MAX_RETRY = 5;

@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  // 取当前用户邀请码（不存在则生成）
  async getMyCode(uid: string): Promise<{ code: string; createdAt: string }> {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId: uid } });
    if (existing) return { code: existing.code, createdAt: existing.createdAt.toISOString() };
    const code = await this.generateUniqueCode();
    const rc = await this.prisma.referralCode.create({
      data: { userId: uid, code },
    });
    return { code: rc.code, createdAt: rc.createdAt.toISOString() };
  }

  // 统计我邀请的人数
  async getMyStats(uid: string): Promise<{ count: number; records: Array<{ refereeId: string; createdAt: string }> }> {
    const [records, count] = await this.prisma.$transaction([
      this.prisma.referralRecord.findMany({
        where: { referrerId: uid },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { referee: { select: { nickname: true, avatarUrl: true } } },
      }),
      this.prisma.referralRecord.count({ where: { referrerId: uid } }),
    ]);
    return {
      count,
      records: records.map((r) => ({
        refereeId: r.refereeId,
        refereeNickname: r.referee.nickname,
        refereeAvatarUrl: r.referee.avatarUrl,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // 登录时回调：新用户首次注册若带 referralCode，建立邀请关联
  // 已是老用户（已存在 ReferralRecord 或自己邀请自己）-> 静默忽略（不阻断登录）
  async onUserRegistered(uid: string, referralCode?: string): Promise<void> {
    if (!referralCode) return;
    const referrer = await this.prisma.referralCode.findUnique({
      where: { code: referralCode },
      select: { userId: true },
    });
    if (!referrer) {
      // 邀请码无效：不阻断登录，仅忽略（前端分享码可能过期/拼错）
      return;
    }
    if (referrer.userId === uid) {
      // 不能邀请自己
      return;
    }
    // 已有邀请记录（被邀请人唯一约束兜底）-> 忽略
    const existing = await this.prisma.referralRecord.findUnique({
      where: { refereeId: uid },
      select: { id: true },
    });
    if (existing) return;
    try {
      await this.prisma.referralRecord.create({
        data: { referrerId: referrer.userId, refereeId: uid, referralCode },
      });
    } catch (e) {
      // 并发双写：P2002 唯一约束 -> 静默忽略
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return;
      throw e;
    }
  }

  // 生成唯一邀请码（碰撞重试）
  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < CODE_MAX_RETRY; i++) {
      let code = '';
      for (let j = 0; j < CODE_LENGTH; j++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      const clash = await this.prisma.referralCode.findUnique({ where: { code } });
      if (!clash) return code;
    }
    throw new BizException(80001, '邀请码生成失败，请重试', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}