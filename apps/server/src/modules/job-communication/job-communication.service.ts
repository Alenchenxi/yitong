import { HttpStatus, Injectable } from '@nestjs/common';
import { AppStatus, InterviewInvitationStatus, JobConversationMessageType, Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { ModerationService } from '../moderation/moderation.service';
import type {
  CreateInterviewInvitationDto,
  InterviewResponseAction,
  JobExchangeKind,
} from './dto/job-communication.dto';
import { assertTencentMeetingUrl, parseTencentMeetingShare } from './tencent-meeting.parser';

const READ_ONLY_STATUSES: AppStatus[] = [AppStatus.CANCELLED, AppStatus.REJECTED];
const MESSAGE_PAGE_SIZE = 30;

interface MessageCursor {
  createdAt: Date;
  id?: string;
}

type ContactExchangePayload = {
  kind: 'PHONE' | 'WECHAT';
  student: { name: string; value: string };
  merchant: { name: string; value: string };
};

type ResumeExchangePayload = {
  kind: 'RESUME';
  resume: {
    name: string;
    phone: string;
    wechat: string | null;
    selfIntro: string | null;
    skills: string[];
    availabilities: string[];
    experience: string | null;
    updatedAt: string;
  };
};

type JobExchangePayload = ContactExchangePayload | ResumeExchangePayload;

type CommunicationApplication = Prisma.JobApplicationGetPayload<{
  include: {
    user: { select: { nickname: true; avatarUrl: true } };
    jobPost: { include: { merchant: { select: { id: true; userId: true; shopName: true; contactPhone: true; contactWechat: true } } } };
  };
}>;

@Injectable()
export class JobCommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly gateway: ChatGateway,
  ) {}

  async ensureConversation(actorId: string, applicationId: string) {
    const app = await this.loadApplication(applicationId);
    this.assertParticipant(actorId, app);
    const conversation = await this.prisma.jobConversation.upsert({
      where: { applicationId },
      update: {},
      create: {
        applicationId,
        studentId: app.userId,
        merchantUserId: app.jobPost.merchant.userId,
      },
    });
    return this.toConversation(conversation, app, actorId);
  }

  async getConversation(actorId: string, conversationId: string) {
    const conversation = await this.prisma.jobConversation.findUnique({
      where: { id: conversationId },
      include: {
        application: {
          include: {
            user: { select: { nickname: true, avatarUrl: true } },
            jobPost: { include: { merchant: { select: { id: true, userId: true, shopName: true, contactPhone: true, contactWechat: true } } } },
          },
        },
      },
    });
    if (!conversation) throw new BizException(40001, '岗位会话不存在', HttpStatus.NOT_FOUND);
    this.assertParticipant(actorId, conversation.application);
    return this.toConversation(conversation, conversation.application, actorId);
  }

  async listMessages(actorId: string, conversationId: string, cursor?: string) {
    await this.getConversation(actorId, conversationId);
    const where: Prisma.JobConversationMessageWhereInput = { conversationId };
    const parsedCursor = cursor ? this.parseMessageCursor(cursor) : null;
    if (parsedCursor?.id) {
      where.OR = [
        { createdAt: { lt: parsedCursor.createdAt } },
        { createdAt: parsedCursor.createdAt, id: { lt: parsedCursor.id } },
      ];
    } else if (parsedCursor) {
      // 兼容上线前仅使用 ISO 时间的旧游标。
      where.createdAt = { lt: parsedCursor.createdAt };
    }
    const rows = await this.prisma.jobConversationMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MESSAGE_PAGE_SIZE + 1,
    });
    const slice = rows.slice(0, MESSAGE_PAGE_SIZE);
    const invitationIds = slice.map((m) => m.interviewInvitationId).filter((id): id is string => !!id);
    const invitations = invitationIds.length
      ? await this.prisma.interviewInvitation.findMany({ where: { id: { in: invitationIds } } })
      : [];
    const invitationMap = new Map(invitations.map((item) => [item.id, this.toInvitation(item)]));
    const oldest = slice[slice.length - 1];
    const nextCursor = rows.length > MESSAGE_PAGE_SIZE && oldest
      ? this.encodeMessageCursor(oldest.createdAt, oldest.id)
      : null;
    return {
      list: slice.reverse().map((m) => ({
        id: m.id,
        senderId: m.senderId,
        type: m.type,
        content: m.content,
        clientMessageId: m.clientMessageId ?? null,
        invitation: m.interviewInvitationId ? invitationMap.get(m.interviewInvitationId) ?? null : null,
        exchange: m.exchangePayload ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore: rows.length > MESSAGE_PAGE_SIZE,
    };
  }

  async sendText(actorId: string, conversationId: string, content: string, clientMessageId?: string) {
    const conversation = await this.prisma.jobConversation.findUnique({
      where: { id: conversationId },
      include: { application: { include: { jobPost: { include: { merchant: { select: { userId: true } } } } } } },
    });
    if (!conversation) throw new BizException(40001, "岗位会话不存在", HttpStatus.NOT_FOUND);
    this.assertParticipant(actorId, conversation.application);
    this.assertWritable(conversation.application.status);
    const text = content.trim();
    if (!text) throw new BizException(40006, "消息不能为空", HttpStatus.BAD_REQUEST);
    const normalizedClientMessageId = this.normalizeClientMessageId(clientMessageId);

    await this.moderation.checkText(text);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockApplication(tx, conversation.applicationId);
      const lockedConversation = await tx.jobConversation.findUnique({
        where: { id: conversationId },
        include: { application: { include: { jobPost: { include: { merchant: { select: { userId: true } } } } } } },
      });
      if (!lockedConversation) throw new BizException(40001, "岗位会话不存在", HttpStatus.NOT_FOUND);
      this.assertParticipant(actorId, lockedConversation.application);
      this.assertWritable(lockedConversation.application.status);

      if (normalizedClientMessageId) {
        const existing = await tx.jobConversationMessage.findFirst({
          where: {
            conversationId,
            senderId: actorId,
            clientMessageId: normalizedClientMessageId,
          },
        });
        if (existing) return { message: existing, peerId: null, created: false };
      }

      const message = await tx.jobConversationMessage.create({
        data: {
          conversationId,
          senderId: actorId,
          type: JobConversationMessageType.TEXT,
          content: text,
          clientMessageId: normalizedClientMessageId ?? null,
        },
      });
      const peerId = actorId === lockedConversation.studentId
        ? lockedConversation.merchantUserId
        : lockedConversation.studentId;
      return { message, peerId, created: true };
    });

    const vo = {
      id: result.message.id,
      senderId: result.message.senderId,
      type: result.message.type,
      content: result.message.content,
      clientMessageId: result.message.clientMessageId ?? null,
      invitation: null,
      exchange: null,
      createdAt: result.message.createdAt.toISOString(),
    };
    if (result.created && result.peerId) {
      this.gateway.sendToUser(result.peerId, { type: "job-message", conversationId, message: vo });
    }
    return vo;
  }

  async sendExchange(actorId: string, conversationId: string, kind: JobExchangeKind, clientMessageId?: string) {
    const conversation = await this.prisma.jobConversation.findUnique({
      where: { id: conversationId },
      include: {
        application: {
          include: {
            user: { select: { nickname: true, avatarUrl: true } },
            jobPost: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    userId: true,
                    shopName: true,
                    contactPhone: true,
                    contactWechat: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!conversation) throw new BizException(40001, '岗位会话不存在', HttpStatus.NOT_FOUND);
    this.assertStudent(actorId, conversation.application);
    this.assertWritable(conversation.application.status);
    const normalizedClientMessageId = this.normalizeClientMessageId(clientMessageId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockApplication(tx, conversation.applicationId);
      const lockedConversation = await tx.jobConversation.findUnique({
        where: { id: conversationId },
        include: {
          application: {
            include: {
              user: { select: { nickname: true, avatarUrl: true } },
              jobPost: {
                include: {
                  merchant: {
                    select: {
                      id: true,
                      userId: true,
                      shopName: true,
                      contactPhone: true,
                      contactWechat: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!lockedConversation) throw new BizException(40001, '岗位会话不存在', HttpStatus.NOT_FOUND);
      this.assertStudent(actorId, lockedConversation.application);
      this.assertWritable(lockedConversation.application.status);

      if (normalizedClientMessageId) {
        const existing = await tx.jobConversationMessage.findFirst({
          where: {
            conversationId,
            senderId: actorId,
            clientMessageId: normalizedClientMessageId,
          },
        });
        if (existing) return { message: existing, peerId: null, created: false };
      }

      const resume = await tx.resume.findUnique({ where: { userId: actorId } });
      const exchangePayload = this.buildExchangePayload(kind, lockedConversation.application, resume);
      const message = await tx.jobConversationMessage.create({
        data: {
          conversationId,
          senderId: actorId,
          type: kind === 'RESUME'
            ? JobConversationMessageType.RESUME_EXCHANGE
            : JobConversationMessageType.CONTACT_EXCHANGE,
          content: kind === 'PHONE' ? '交换电话' : kind === 'WECHAT' ? '交换微信' : '交换简历',
          clientMessageId: normalizedClientMessageId ?? null,
          exchangePayload: exchangePayload as Prisma.InputJsonValue,
        },
      });
      return {
        message,
        peerId: lockedConversation.merchantUserId,
        created: true,
      };
    });

    const vo = {
      id: result.message.id,
      senderId: result.message.senderId,
      type: result.message.type,
      content: result.message.content,
      clientMessageId: result.message.clientMessageId ?? null,
      invitation: null,
      exchange: result.message.exchangePayload ?? null,
      createdAt: result.message.createdAt.toISOString(),
    };
    if (result.created && result.peerId) {
      this.gateway.sendToUser(result.peerId, { type: 'job-message', conversationId, message: vo });
    }
    return vo;
  }

  async parseMeetingShare(actorId: string, applicationId: string, input: string) {
    const app = await this.loadApplication(applicationId);
    this.assertMerchant(actorId, app);
    return parseTencentMeetingShare(input);
  }

  async sendInterviewInvitation(actorId: string, applicationId: string, dto: CreateInterviewInvitationDto) {
    const app = await this.loadApplication(applicationId);
    this.assertMerchant(actorId, app);
    this.assertWritable(app.status);
    const normalized = this.normalizeInterviewInvitation(dto);

    await this.moderation.checkText([normalized.title, normalized.interviewerName].join(" "));

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockApplication(tx, applicationId);
      const lockedApp = await tx.jobApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: { select: { nickname: true, avatarUrl: true } },
          jobPost: { include: { merchant: { select: { id: true, userId: true, shopName: true } } } },
        },
      });
      if (!lockedApp) throw new BizException(40001, "报名记录不存在", HttpStatus.NOT_FOUND);
      this.assertMerchant(actorId, lockedApp);
      this.assertWritable(lockedApp.status);

      const conversation = await tx.jobConversation.upsert({
        where: { applicationId },
        update: {},
        create: {
          applicationId,
          studentId: lockedApp.userId,
          merchantUserId: lockedApp.jobPost.merchant.userId,
        },
      });
      const invitation = await tx.interviewInvitation.create({
        data: {
          applicationId,
          conversationId: conversation.id,
          createdById: actorId,
          meetingUrl: normalized.meetingUrl,
          title: normalized.title,
          meetingDate: normalized.meetingDate,
          meetingTime: normalized.meetingTime,
          meetingNo: normalized.meetingNo,
          password: normalized.password,
          interviewerName: normalized.interviewerName,
        },
      });
      const message = await tx.jobConversationMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: actorId,
          type: JobConversationMessageType.INTERVIEW,
          content: invitation.title,
          interviewInvitationId: invitation.id,
        },
      });
      return { lockedApp, conversation, invitation, message };
    });

    const invitation = this.toInvitation(result.invitation);
    const vo = {
      id: result.message.id,
      senderId: actorId,
      type: JobConversationMessageType.INTERVIEW,
      content: result.message.content,
      clientMessageId: result.message.clientMessageId ?? null,
      exchange: null,
      invitation,
      createdAt: result.message.createdAt.toISOString(),
    };
    this.gateway.sendToUser(result.lockedApp.userId, {
      type: "job-message",
      conversationId: result.conversation.id,
      message: vo,
    });
    return vo;
  }

  async cancelInterviewInvitation(actorId: string, invitationId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockInterviewInvitation(tx, invitationId);
      const invitation = await tx.interviewInvitation.findUnique({
        where: { id: invitationId },
        include: { application: { include: { jobPost: { include: { merchant: { select: { userId: true } } } } } } },
      });
      if (!invitation) throw new BizException(40001, '面试邀请不存在', HttpStatus.NOT_FOUND);
      this.assertMerchant(actorId, invitation.application);
      if (invitation.status === InterviewInvitationStatus.CANCELLED) {
        return { invitation, changed: false };
      }
      if (
        invitation.status !== InterviewInvitationStatus.PENDING
        && invitation.status !== InterviewInvitationStatus.ACCEPTED
      ) {
        throw new BizException(40004, '已拒绝的面试邀请不能取消', HttpStatus.CONFLICT);
      }
      await this.lockApplication(tx, invitation.applicationId);
      const lockedApplication = await tx.jobApplication.findUnique({
        where: { id: invitation.applicationId },
        include: { jobPost: { include: { merchant: { select: { userId: true } } } } },
      });
      if (!lockedApplication) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
      this.assertMerchant(actorId, lockedApplication);
      this.assertWritable(lockedApplication.status);
      const updated = await tx.interviewInvitation.update({
        where: { id: invitationId },
        data: { status: InterviewInvitationStatus.CANCELLED, cancelledAt: new Date() },
      });
      return { invitation: { ...updated, application: lockedApplication }, changed: true };
    });
    const invitation = this.toInvitation(result.invitation);
    if (result.changed) {
      this.gateway.sendToUser(result.invitation.application.userId, {
        type: 'job-interview-updated',
        conversationId: result.invitation.conversationId,
        invitationId,
        invitation,
      });
      // Older clients only understand this cancellation event.
      this.gateway.sendToUser(result.invitation.application.userId, {
        type: 'job-interview-cancelled',
        conversationId: result.invitation.conversationId,
        invitationId,
      });
    }
    return invitation;
  }

  async respondInterviewInvitation(
    actorId: string,
    invitationId: string,
    action: InterviewResponseAction,
  ) {
    const targetStatus = action === 'accept'
      ? InterviewInvitationStatus.ACCEPTED
      : InterviewInvitationStatus.REJECTED;
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockInterviewInvitation(tx, invitationId);
      const invitation = await tx.interviewInvitation.findUnique({
        where: { id: invitationId },
        include: { application: { include: { jobPost: { include: { merchant: { select: { userId: true } } } } } } },
      });
      if (!invitation) throw new BizException(40001, '面试邀请不存在', HttpStatus.NOT_FOUND);
      this.assertStudent(actorId, invitation.application);
      if (invitation.status === targetStatus) {
        return { invitation, merchantUserId: invitation.application.jobPost.merchant.userId, changed: false };
      }
      if (invitation.status !== InterviewInvitationStatus.PENDING) {
        throw new BizException(40004, '面试邀请已处理，不能重复变更', HttpStatus.CONFLICT);
      }
      await this.lockApplication(tx, invitation.applicationId);
      const lockedApplication = await tx.jobApplication.findUnique({
        where: { id: invitation.applicationId },
        include: { jobPost: { include: { merchant: { select: { userId: true } } } } },
      });
      if (!lockedApplication) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
      this.assertStudent(actorId, lockedApplication);
      this.assertWritable(lockedApplication.status);
      const updated = await tx.interviewInvitation.update({
        where: { id: invitationId },
        data: {
          status: targetStatus,
          respondedAt: new Date(),
        },
      });
      return {
        invitation: updated,
        merchantUserId: lockedApplication.jobPost.merchant.userId,
        changed: true,
      };
    });
    const invitation = this.toInvitation(result.invitation);
    if (result.changed) {
      this.gateway.sendToUser(result.merchantUserId, {
        type: 'job-interview-updated',
        conversationId: result.invitation.conversationId,
        invitationId,
        invitation,
      });
    }
    return invitation;
  }

  private async lockApplication(tx: Prisma.TransactionClient, applicationId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>
      `SELECT "id"
       FROM "job_applications"
       WHERE "id" = ${applicationId}
       FOR UPDATE`;
    if (!rows.length) throw new BizException(40001, "报名记录不存在", HttpStatus.NOT_FOUND);
  }

  private async lockInterviewInvitation(tx: Prisma.TransactionClient, invitationId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>
      `SELECT "id"
       FROM "interview_invitations"
       WHERE "id" = ${invitationId}
       FOR UPDATE`;
    if (!rows.length) throw new BizException(40001, '面试邀请不存在', HttpStatus.NOT_FOUND);
  }

  private buildExchangePayload(
    kind: JobExchangeKind,
    app: {
      user?: { nickname: string } | null;
      jobPost: {
        publisherName: string | null;
        contactPhoneSnapshot: string | null;
        contactWechatSnapshot: string | null;
        merchant: {
          shopName: string;
          contactPhone: string;
          contactWechat: string | null;
        };
      };
    },
    resume: {
      name: string;
      phone: string;
      wechat: string | null;
      selfIntro: string | null;
      skills: string[];
      availabilities: string[];
      experience: string | null;
      updatedAt: Date;
    } | null,
  ): JobExchangePayload {
    if (!resume) {
      throw new BizException(40008, '请先在我的简历中完善个人信息', HttpStatus.BAD_REQUEST);
    }

    if (kind === 'RESUME') {
      return {
        kind,
        resume: {
          name: resume.name,
          phone: resume.phone,
          wechat: resume.wechat?.trim() || null,
          selfIntro: resume.selfIntro,
          skills: [...resume.skills],
          availabilities: [...resume.availabilities],
          experience: resume.experience,
          updatedAt: resume.updatedAt.toISOString(),
        },
      };
    }

    const studentValue = kind === 'PHONE' ? resume.phone.trim() : resume.wechat?.trim() ?? '';
    if (!studentValue) {
      const label = kind === 'PHONE' ? '电话' : '微信';
      throw new BizException(40008, `请先在我的简历中配置${label}`, HttpStatus.BAD_REQUEST);
    }

    const merchant = app.jobPost.merchant;
    const merchantValue = kind === 'PHONE'
      ? app.jobPost.contactPhoneSnapshot?.trim() || merchant.contactPhone.trim()
      : app.jobPost.contactWechatSnapshot?.trim() || merchant.contactWechat?.trim() || '';
    if (!merchantValue) {
      const label = kind === 'PHONE' ? '电话' : '微信';
      throw new BizException(40008, `岗位发布方未配置${label}`, HttpStatus.BAD_REQUEST);
    }

    return {
      kind,
      student: {
        name: resume.name.trim() || app.user?.nickname || '报名用户',
        value: studentValue,
      },
      merchant: {
        name: app.jobPost.publisherName?.trim() || merchant.shopName,
        value: merchantValue,
      },
    };
  }

  private normalizeClientMessageId(clientMessageId?: string) {
    if (clientMessageId === undefined) return undefined;
    const normalized = clientMessageId.trim();
    if (!normalized || normalized.length > 100) {
      throw new BizException(40006, "消息幂等标识无效", HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private normalizeInterviewInvitation(dto: CreateInterviewInvitationDto) {
    const title = dto.title.trim();
    const interviewerName = dto.interviewerName.trim();
    const meetingDate = dto.meetingDate.trim();
    const meetingTime = dto.meetingTime.trim();
    if (!title) throw new BizException(40006, "面试标题不能为空", HttpStatus.BAD_REQUEST);
    if (!interviewerName) throw new BizException(40006, "面试官不能为空", HttpStatus.BAD_REQUEST);

    const parsedDate = new Date(`${meetingDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== meetingDate
    ) {
      throw new BizException(40006, "面试日期无效", HttpStatus.BAD_REQUEST);
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(meetingTime)) {
      throw new BizException(40006, "面试时间无效", HttpStatus.BAD_REQUEST);
    }

    return {
      meetingUrl: assertTencentMeetingUrl(dto.meetingUrl.trim()),
      title,
      meetingDate,
      meetingTime,
      meetingNo: dto.meetingNo?.replace(/\s+/g, "") || null,
      password: dto.password?.trim() || null,
      interviewerName,
    };
  }

  private loadApplication(applicationId: string) {
    return this.prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: { select: { nickname: true, avatarUrl: true } },
        jobPost: { include: { merchant: { select: { id: true, userId: true, shopName: true, contactPhone: true, contactWechat: true } } } },
      },
    }).then((app) => {
      if (!app) throw new BizException(40001, '报名记录不存在', HttpStatus.NOT_FOUND);
      return app;
    });
  }

  private assertParticipant(actorId: string, app: { userId: string; jobPost: { merchant: { userId: string } } }) {
    if (actorId !== app.userId && actorId !== app.jobPost.merchant.userId) {
      throw new BizException(10003, '仅报名双方可访问岗位会话', HttpStatus.FORBIDDEN);
    }
  }

  private assertStudent(actorId: string, app: { userId: string }) {
    if (actorId !== app.userId) {
      throw new BizException(10003, '仅报名用户可发起信息交换', HttpStatus.FORBIDDEN);
    }
  }

  private assertMerchant(actorId: string, app: { jobPost: { merchant: { userId: string } } }) {
    if (actorId !== app.jobPost.merchant.userId) throw new BizException(10003, '仅岗位商家可操作面试邀请', HttpStatus.FORBIDDEN);
  }

  private assertWritable(status: AppStatus) {
    if (READ_ONLY_STATUSES.includes(status)) throw new BizException(40004, '报名已结束，会话仅可查看历史', HttpStatus.CONFLICT);
  }

  private parseMessageCursor(cursor: string): MessageCursor | null {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        createdAt?: unknown;
        id?: unknown;
      };
      if (typeof decoded.createdAt === 'string' && typeof decoded.id === 'string' && decoded.id) {
        const createdAt = new Date(decoded.createdAt);
        if (!Number.isNaN(createdAt.getTime())) return { createdAt, id: decoded.id };
      }
    } catch {
      // 继续尝试旧版 ISO 时间游标。
    }
    const legacyDate = new Date(cursor);
    return Number.isNaN(legacyDate.getTime()) ? null : { createdAt: legacyDate };
  }

  private encodeMessageCursor(createdAt: Date, id: string) {
    return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString('base64url');
  }

  private toConversation(
    conversation: {
      id: string;
      applicationId: string;
      studentId: string;
      merchantUserId: string;
      createdAt: Date;
      updatedAt: Date;
    },
    app: CommunicationApplication,
    actorId: string,
  ) {
    const isMerchant = actorId === app.jobPost.merchant.userId;
    return {
      id: conversation.id,
      applicationId: conversation.applicationId,
      role: isMerchant ? 'merchant' : 'student',
      readOnly: READ_ONLY_STATUSES.includes(app.status),
      applicationStatus: app.status,
      jobPost: { id: app.jobPost.id, title: app.jobPost.title, salary: app.jobPost.salary ?? '', location: app.jobPost.location ?? '' },
      peer: isMerchant
        ? { id: app.userId, name: app.user?.nickname ?? '候选人', avatarUrl: app.user?.avatarUrl ?? null }
        : { id: app.jobPost.merchant.userId, name: app.jobPost.merchant.shopName, avatarUrl: null },
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toInvitation(item: {
    id: string;
    meetingUrl: string;
    title: string;
    meetingDate: string;
    meetingTime: string;
    meetingNo: string | null;
    password: string | null;
    interviewerName: string;
    status: InterviewInvitationStatus;
    respondedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      meetingUrl: item.meetingUrl,
      title: item.title,
      meetingDate: item.meetingDate,
      meetingTime: item.meetingTime,
      meetingNo: item.meetingNo,
      password: item.password,
      interviewerName: item.interviewerName,
      status: item.status,
      respondedAt: item.respondedAt?.toISOString() ?? null,
      cancelledAt: item.cancelledAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }
}
