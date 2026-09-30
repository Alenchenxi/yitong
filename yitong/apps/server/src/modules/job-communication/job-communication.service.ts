import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AppStatus,
  InterviewInvitationStatus,
  JobConversationMessageType,
  JobExchangeKind as PrismaJobExchangeKind,
  JobExchangeStatus,
  Prisma,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';
import { ModerationService } from '../moderation/moderation.service';
import type {
  CreateInterviewInvitationDto,
  InterviewResponseAction,
  JobExchangeKind,
  JobExchangeResponseAction,
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

type CommunicationMessage = {
  id: string;
  senderId: string;
  type: JobConversationMessageType;
  content: string;
  clientMessageId: string | null;
  interviewInvitationId: string | null;
  exchangeKind: PrismaJobExchangeKind | null;
  exchangeStatus: JobExchangeStatus | null;
  exchangeRespondedAt: Date | null;
  exchangePayload: Prisma.JsonValue | null;
  createdAt: Date;
};

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
    return this.getConversation(actorId, conversation.id);
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
        messages: {
          where: { exchangeStatus: JobExchangeStatus.PENDING },
          select: { exchangeKind: true },
        },
      },
    });
    if (!conversation) throw new BizException(40001, '岗位会话不存在', HttpStatus.NOT_FOUND);
    this.assertParticipant(actorId, conversation.application);
    const pendingExchangeKinds = (conversation.messages ?? [])
      .map((message) => message.exchangeKind)
      .filter((kind): kind is PrismaJobExchangeKind => kind !== null);
    const textSenders = await this.prisma.jobConversationMessage.groupBy({
      by: ['senderId'],
      where: {
        conversationId,
        senderId: { in: [conversation.studentId, conversation.merchantUserId] },
        type: JobConversationMessageType.TEXT,
      },
    });
    const exchangeReady = this.isExchangeReady(textSenders, conversation);
    return this.toConversation(conversation, conversation.application, actorId, pendingExchangeKinds, exchangeReady);
  }

  async listMessages(actorId: string, conversationId: string, cursor?: string) {
    const conversation = await this.prisma.jobConversation.findUnique({
      where: { id: conversationId },
      select: {
        application: {
          select: {
            userId: true,
            jobPost: { select: { merchant: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!conversation) throw new BizException(40001, '岗位会话不存在', HttpStatus.NOT_FOUND);
    this.assertParticipant(actorId, conversation.application);
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
      list: slice.reverse().map((message) => this.toMessage(
        message,
        message.interviewInvitationId ? invitationMap.get(message.interviewInvitationId) ?? null : null,
      )),
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

    const vo = this.toMessage(result.message, null);
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
    this.assertParticipant(actorId, conversation.application);
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

      const textSenders = await tx.jobConversationMessage.groupBy({
        by: ['senderId'],
        where: {
          conversationId,
          senderId: { in: [lockedConversation.studentId, lockedConversation.merchantUserId] },
          type: JobConversationMessageType.TEXT,
        },
      });
      if (!this.isExchangeReady(textSenders, lockedConversation)) {
        throw new BizException(40004, '需要对方回复后才可以使用', HttpStatus.CONFLICT);
      }

      const pending = await tx.jobConversationMessage.findFirst({
        where: {
          conversationId,
          exchangeKind: PrismaJobExchangeKind[kind],
          exchangeStatus: JobExchangeStatus.PENDING,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (pending) return { message: pending, peerId: null, created: false };

      const resume = await tx.resume.findUnique({ where: { userId: lockedConversation.studentId } });
      this.buildExchangePayload(kind, lockedConversation.application, resume);
      const message = await tx.jobConversationMessage.create({
        data: {
          conversationId,
          senderId: actorId,
          type: kind === 'RESUME'
            ? JobConversationMessageType.RESUME_EXCHANGE
            : JobConversationMessageType.CONTACT_EXCHANGE,
          content: kind === 'PHONE' ? '请求交换电话' : kind === 'WECHAT' ? '请求交换微信' : '请求交换简历',
          clientMessageId: normalizedClientMessageId ?? null,
          exchangeKind: PrismaJobExchangeKind[kind],
          exchangeStatus: JobExchangeStatus.PENDING,
        },
      });
      const peerId = actorId === lockedConversation.studentId
        ? lockedConversation.merchantUserId
        : lockedConversation.studentId;
      return {
        message,
        peerId,
        created: true,
      };
    });

    const vo = this.toMessage(result.message, null);
    if (result.created && result.peerId) {
      this.gateway.sendToUser(result.peerId, { type: 'job-message', conversationId, message: vo });
    }
    return vo;
  }

  async respondExchange(
    actorId: string,
    conversationId: string,
    messageId: string,
    action: JobExchangeResponseAction,
  ) {
    const request = await this.prisma.jobConversationMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
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
        },
      },
    });
    if (!request || request.conversationId !== conversationId) {
      throw new BizException(40001, '交换请求不存在', HttpStatus.NOT_FOUND);
    }
    this.assertParticipant(actorId, request.conversation.application);
    this.assertWritable(request.conversation.application.status);
    this.assertExchangeRequest(request);
    if (request.senderId === actorId) {
      throw new BizException(10003, '只能由请求对方处理交换请求', HttpStatus.FORBIDDEN);
    }

    const targetStatus = action === 'accept' ? JobExchangeStatus.ACCEPTED : JobExchangeStatus.REJECTED;
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockApplication(tx, request.conversation.applicationId);
      await this.lockExchangeMessage(tx, messageId);
      const lockedRequest = await tx.jobConversationMessage.findUnique({
        where: { id: messageId },
        include: {
          conversation: {
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
          },
        },
      });
      if (!lockedRequest || lockedRequest.conversationId !== conversationId) {
        throw new BizException(40001, '交换请求不存在', HttpStatus.NOT_FOUND);
      }
      this.assertParticipant(actorId, lockedRequest.conversation.application);
      this.assertWritable(lockedRequest.conversation.application.status);
      this.assertExchangeRequest(lockedRequest);
      if (lockedRequest.senderId === actorId) {
        throw new BizException(10003, '只能由请求对方处理交换请求', HttpStatus.FORBIDDEN);
      }
      if (lockedRequest.exchangeStatus === targetStatus) {
        return { message: lockedRequest, changed: false };
      }
      if (lockedRequest.exchangeStatus !== JobExchangeStatus.PENDING) {
        throw new BizException(40004, '交换请求已处理，不能重复变更', HttpStatus.CONFLICT);
      }

      let exchangePayload: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
      if (targetStatus === JobExchangeStatus.ACCEPTED) {
        const textSenders = await tx.jobConversationMessage.groupBy({
          by: ['senderId'],
          where: {
            conversationId,
            senderId: {
              in: [lockedRequest.conversation.studentId, lockedRequest.conversation.merchantUserId],
            },
            type: JobConversationMessageType.TEXT,
          },
        });
        if (!this.isExchangeReady(textSenders, lockedRequest.conversation)) {
          throw new BizException(40004, '需要对方回复后才可以使用', HttpStatus.CONFLICT);
        }
        const resume = await tx.resume.findUnique({ where: { userId: lockedRequest.conversation.studentId } });
        exchangePayload = this.buildExchangePayload(
          lockedRequest.exchangeKind,
          lockedRequest.conversation.application,
          resume,
        ) as Prisma.InputJsonValue;
      }
      const message = await tx.jobConversationMessage.update({
        where: { id: messageId },
        data: {
          exchangeStatus: targetStatus,
          exchangeRespondedAt: new Date(),
          exchangePayload,
        },
      });
      return { message, changed: true };
    });

    const vo = this.toMessage(result.message, null);
    if (result.changed) {
      this.gateway.sendToUser(request.senderId, { type: 'job-message', conversationId, message: vo });
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

  private async lockExchangeMessage(tx: Prisma.TransactionClient, messageId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>
      `SELECT "id"
       FROM "job_conversation_messages"
       WHERE "id" = ${messageId}
       FOR UPDATE`;
    if (!rows.length) throw new BizException(40001, '交换请求不存在', HttpStatus.NOT_FOUND);
  }

  private toMessage(message: CommunicationMessage, invitation: ReturnType<JobCommunicationService['toInvitation']> | null) {
    return {
      id: message.id,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      clientMessageId: message.clientMessageId ?? null,
      invitation,
      exchange: this.toExchange(message),
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toExchange(message: CommunicationMessage) {
    if (message.type !== JobConversationMessageType.CONTACT_EXCHANGE
      && message.type !== JobConversationMessageType.RESUME_EXCHANGE) {
      return null;
    }
    const payload = this.asRecord(message.exchangePayload);
    const legacyKind = typeof payload?.kind === 'string' && ['PHONE', 'WECHAT', 'RESUME'].includes(payload.kind)
      ? payload.kind as JobExchangeKind
      : null;
    const kind = message.exchangeKind ?? legacyKind;
    if (!kind) return null;
    const status = message.exchangeStatus ?? (payload ? JobExchangeStatus.ACCEPTED : JobExchangeStatus.PENDING);
    const exchange = {
      kind,
      status,
      requesterId: message.senderId,
      respondedAt: message.exchangeRespondedAt?.toISOString() ?? null,
    };
    if (status !== JobExchangeStatus.ACCEPTED || !payload) return exchange;
    return { ...exchange, ...payload, kind };
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, Prisma.JsonValue>
      : null;
  }

  private assertExchangeRequest(message: {
    type: JobConversationMessageType;
    exchangeKind: PrismaJobExchangeKind | null;
    exchangeStatus: JobExchangeStatus | null;
  }): asserts message is typeof message & { exchangeKind: PrismaJobExchangeKind; exchangeStatus: JobExchangeStatus } {
    const exchangeType = message.type === JobConversationMessageType.CONTACT_EXCHANGE
      || message.type === JobConversationMessageType.RESUME_EXCHANGE;
    if (!exchangeType || !message.exchangeKind || !message.exchangeStatus) {
      throw new BizException(40001, '交换请求不存在', HttpStatus.NOT_FOUND);
    }
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
      throw new BizException(40008, '报名用户尚未完善简历', HttpStatus.BAD_REQUEST);
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
      throw new BizException(40008, `报名用户尚未配置${label}`, HttpStatus.BAD_REQUEST);
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
      throw new BizException(10003, '仅报名用户可处理面试邀请', HttpStatus.FORBIDDEN);
    }
  }

  private assertMerchant(actorId: string, app: { jobPost: { merchant: { userId: string } } }) {
    if (actorId !== app.jobPost.merchant.userId) throw new BizException(10003, '仅岗位商家可操作面试邀请', HttpStatus.FORBIDDEN);
  }

  private assertWritable(status: AppStatus) {
    if (READ_ONLY_STATUSES.includes(status)) throw new BizException(40004, '报名已结束，会话仅可查看历史', HttpStatus.CONFLICT);
  }

  private isExchangeReady(
    textSenders: Array<{ senderId: string }>,
    conversation: { studentId: string; merchantUserId: string },
  ) {
    const senderIds = new Set(textSenders.map((item) => item.senderId));
    return senderIds.has(conversation.studentId) && senderIds.has(conversation.merchantUserId);
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
    pendingExchangeKinds: PrismaJobExchangeKind[],
    exchangeReady: boolean,
  ) {
    const isMerchant = actorId === app.jobPost.merchant.userId;
    return {
      id: conversation.id,
      applicationId: conversation.applicationId,
      role: isMerchant ? 'merchant' : 'student',
      readOnly: READ_ONLY_STATUSES.includes(app.status),
      applicationStatus: app.status,
      exchangeReady,
      pendingExchangeKinds: [...new Set(pendingExchangeKinds)],
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
