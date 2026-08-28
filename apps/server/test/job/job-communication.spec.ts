/**
 * 招聘沟通回归测试：全部使用 Prisma mock，不连接数据库，不产生测试数据。
 */
import { AppStatus, JobDuration, JobPostStatus, PayScene, PayStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { CreateInterviewInvitationDto } from '../../src/modules/job-communication/dto/job-communication.dto';
import { JobCommunicationService } from '../../src/modules/job-communication/job-communication.service';
import { parseTencentMeetingShare } from '../../src/modules/job-communication/tencent-meeting.parser';
import { JobService } from '../../src/modules/job/job.service';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';
import { MerchantService } from '../../src/modules/merchant/merchant.service';
import { PaymentService } from '../../src/modules/payment/payment.service';

describe('parseTencentMeetingShare', () => {
  it('应从腾讯会议分享文本识别可验证的会议字段', () => {
    expect(
      parseTencentMeetingShare(`腾讯会议：校园活动助理面试
会议时间：2026/08/29 14:30-15:00
点击链接入会：https://meeting.tencent.com/dm/AbCdEf
会议号：123 456 789
会议密码：2468
面试官：陈老师`),
    ).toEqual({
      meetingUrl: 'https://meeting.tencent.com/dm/AbCdEf',
      title: '校园活动助理面试',
      meetingDate: '2026-08-29',
      meetingTime: '14:30',
      meetingNo: '123456789',
      password: '2468',
      interviewerName: '陈老师',
    });
  });

  it('应拒绝非腾讯会议官方域名', () => {
    expect(() => parseTencentMeetingShare('https://evil.example.com/dm/abc')).toThrow(BizException);
  });
});

describe("CreateInterviewInvitationDto", () => {
  function buildDto(overrides: Partial<CreateInterviewInvitationDto> = {}) {
    return Object.assign(new CreateInterviewInvitationDto(), {
      meetingUrl: "https://meeting.tencent.com/dm/AbCdEf",
      title: "校园活动助理面试",
      meetingDate: "2026-08-29",
      meetingTime: "14:30",
      interviewerName: "陈老师",
      ...overrides,
    });
  }

  it.each([
    ["title", "   "],
    ["interviewerName", "\t  "],
  ] as const)("%s 只有空白字符时应校验失败", async (field, value) => {
    const errors = await validate(buildDto({ [field]: value }));
    expect(errors.some((error) => error.property === field)).toBe(true);
  });

  it("不存在的日历日期应校验失败", async () => {
    const errors = await validate(buildDto({ meetingDate: "2026-02-31" }));
    expect(errors.some((error) => error.property === "meetingDate")).toBe(true);
  });
});

function buildService(
  status: AppStatus = AppStatus.PENDING,
  lockedStatus: AppStatus = status,
) {
  const app = {
    id: "app_a",
    userId: "student_a",
    status,
    jobPost: {
      id: "post_a",
      title: "校园活动助理",
      merchant: { id: "merchant_a", userId: "merchant_user_a", shopName: "校园服务站" },
    },
  };
  const lockedApp = { ...app, status: lockedStatus };
  const conversation = {
    id: "conversation_a",
    applicationId: app.id,
    studentId: app.userId,
    merchantUserId: app.jobPost.merchant.userId,
    createdAt: new Date("2026-08-27T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T00:00:00.000Z"),
  };
  const message = {
    id: "message_a",
    conversationId: conversation.id,
    senderId: app.userId,
    type: "TEXT",
    content: "你好",
    clientMessageId: "client_a",
    interviewInvitationId: null,
    createdAt: new Date("2026-08-27T00:01:00.000Z"),
  };
  const jobConversationMessage = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(message),
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: app.id }]),
    jobApplication: { findUnique: jest.fn().mockResolvedValue(lockedApp) },
    jobConversation: {
      upsert: jest.fn().mockResolvedValue(conversation),
      findUnique: jest.fn().mockResolvedValue({ ...conversation, application: lockedApp }),
    },
    jobConversationMessage,
    interviewInvitation: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
  };
  const prisma = {
    jobApplication: { findUnique: jest.fn().mockResolvedValue(app) },
    jobConversation: {
      upsert: jest.fn().mockResolvedValue(conversation),
      findUnique: jest.fn().mockResolvedValue({ ...conversation, application: app }),
    },
    jobConversationMessage,
    interviewInvitation: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const moderation = { checkText: jest.fn().mockResolvedValue(undefined) };
  const gateway = { sendToUser: jest.fn() };
  return {
    service: new JobCommunicationService(prisma as never, moderation as never, gateway as never),
    prisma,
    tx,
    moderation,
    gateway,
    app,
    lockedApp,
    conversation,
    message,
  };
}

describe('JobCommunicationService', () => {
  it.each(['student_a', 'merchant_user_a'])('报名学生和岗位商家都应复用同一报名会话（%s）', async (uid) => {
    const { service, prisma } = buildService();
    await expect(service.ensureConversation(uid, 'app_a')).resolves.toMatchObject({ id: 'conversation_a' });
    expect(prisma.jobConversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { applicationId: 'app_a' } }),
    );
  });

  it('非报名参与方应被拒绝', async () => {
    const { service } = buildService();
    await expect(service.ensureConversation('stranger_a', 'app_a')).rejects.toMatchObject({
      bizCode: 10003,
    });
  });

  it.each([AppStatus.CANCELLED, AppStatus.REJECTED])('%s 报名会话应保留历史但禁止继续发送', async (status) => {
    const { service, prisma } = buildService(status);
    await expect(service.sendText('student_a', 'conversation_a', '你好')).rejects.toMatchObject({
      bizCode: 40004,
    });
    expect(prisma.jobConversationMessage.create).not.toHaveBeenCalled();
  });

  it("发送消息应在审核完成后进入事务，并在行锁后重新检查报名状态", async () => {
    const order: string[] = [];
    const { service, prisma, tx, moderation } = buildService(AppStatus.PENDING, AppStatus.CANCELLED);
    moderation.checkText.mockImplementation(async () => { order.push("moderation"); });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      order.push("transaction");
      return callback(tx);
    });

    await expect(
      service.sendText("student_a", "conversation_a", "你好", "client_a"),
    ).rejects.toMatchObject({ bizCode: 40004 });

    expect(order).toEqual(["moderation", "transaction"]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [sql, applicationId] = tx.$queryRaw.mock.calls[0] ?? [];
    expect(Array.from(sql as TemplateStringsArray).join("?")).toContain("FOR UPDATE");
    expect(applicationId).toBe("app_a");
    expect(tx.jobConversationMessage.create).not.toHaveBeenCalled();
  });

  it("发送面试邀请应在审核完成后锁定报名，并拒绝锁后已结束的报名", async () => {
    const order: string[] = [];
    const { service, prisma, tx, moderation } = buildService(AppStatus.PENDING, AppStatus.REJECTED);
    moderation.checkText.mockImplementation(async () => { order.push("moderation"); });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => {
      order.push("transaction");
      return callback(tx);
    });

    await expect(service.sendInterviewInvitation("merchant_user_a", "app_a", {
      meetingUrl: " https://meeting.tencent.com/dm/AbCdEf ",
      title: " 校园活动助理面试 ",
      meetingDate: "2026-08-29",
      meetingTime: "14:30",
      interviewerName: " 陈老师 ",
    })).rejects.toMatchObject({ bizCode: 40004 });

    expect(order).toEqual(["moderation", "transaction"]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.interviewInvitation.create).not.toHaveBeenCalled();
  });

  it("同一会话和 clientMessageId 重试时应返回既有消息且不重复推送", async () => {
    const { service, tx, gateway, message } = buildService();
    tx.jobConversationMessage.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(message);

    const first = await service.sendText("student_a", "conversation_a", "你好", "client_a");
    const second = await service.sendText("student_a", "conversation_a", "你好", "client_a");

    expect(first).toEqual(second);
    expect(first).toMatchObject({ id: "message_a", clientMessageId: "client_a" });
    expect(tx.jobConversationMessage.create).toHaveBeenCalledTimes(1);
    expect(tx.jobConversationMessage.findFirst).toHaveBeenLastCalledWith({
      where: {
        conversationId: "conversation_a",
        senderId: "student_a",
        clientMessageId: "client_a",
      },
    });
    expect(gateway.sendToUser).toHaveBeenCalledTimes(1);
  });

  it("消息列表应回传 clientMessageId 供客户端替换乐观消息", async () => {
    const { service, prisma, message } = buildService();
    prisma.jobConversationMessage.findMany.mockResolvedValue([message]);

    await expect(service.listMessages("student_a", "conversation_a")).resolves.toMatchObject({
      list: [{ id: "message_a", clientMessageId: "client_a" }],
    });
  });

  it.each([
    [{ title: "   " }, "面试标题"],
    [{ interviewerName: "  " }, "面试官"],
    [{ meetingDate: "2026-02-31" }, "面试日期"],
    [{ meetingTime: "24:00" }, "面试时间"],
  ] as const)("服务层应拒绝无效%s", async (overrides, _label) => {
    const { service, prisma } = buildService();
    await expect(service.sendInterviewInvitation("merchant_user_a", "app_a", {
      meetingUrl: " https://meeting.tencent.com/dm/AbCdEf ",
      title: " 校园活动助理面试 ",
      meetingDate: "2026-08-29",
      meetingTime: "14:30",
      interviewerName: " 陈老师 ",
      ...overrides,
    })).rejects.toMatchObject({ bizCode: 40006 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('只有商家可以发送面试邀请', async () => {
    const { service } = buildService();
    try {
      await service.sendInterviewInvitation('student_a', 'app_a', {
        meetingUrl: 'https://meeting.tencent.com/dm/AbCdEf',
        title: '校园活动助理面试',
        meetingDate: '2026-08-29',
        meetingTime: '14:30',
        meetingNo: '123456789',
        password: '2468',
        interviewerName: '陈老师',
      });
      throw new Error('预期学生发送面试邀请会被拒绝');
    } catch (error) {
      expect(error).toBeInstanceOf(BizException);
      expect(error).toMatchObject({ bizCode: 10003 });
    }
  });

  it('消息分页应按时间正序返回，并以本页最旧消息作为下一页游标', async () => {
    const { service, prisma } = buildService();
    const messages = Array.from({ length: 31 }, (_, index) => {
      const minute = 31 - index;
      return {
        id: `message_${minute}`,
        senderId: minute % 2 ? 'student_a' : 'merchant_user_a',
        type: 'TEXT',
        content: `消息 ${minute}`,
        interviewInvitationId: null,
        createdAt: new Date(`2026-08-27T00:${String(minute).padStart(2, '0')}:00.000Z`),
      };
    });
    prisma.jobConversationMessage.findMany.mockResolvedValue(messages);

    const result = await service.listMessages('student_a', 'conversation_a');
    const decodedCursor = JSON.parse(Buffer.from(result.nextCursor ?? '', 'base64url').toString('utf8'));

    expect(result.hasMore).toBe(true);
    expect(decodedCursor).toEqual({
      createdAt: '2026-08-27T00:02:00.000Z',
      id: 'message_2',
    });
    expect(result.list).toHaveLength(30);
    expect(result.list[0]?.id).toBe('message_2');
    expect(result.list[29]?.id).toBe('message_31');
    expect(prisma.jobConversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 31,
      }),
    );
  });

  it('同毫秒消息跨页时应使用时间和消息 ID 复合游标，避免漏消息', async () => {
    const { service, prisma } = buildService();
    const createdAt = new Date('2026-08-27T00:01:00.000Z');
    const firstPage = Array.from({ length: 31 }, (_, index) => ({
      id: `message_${String(40 - index).padStart(2, '0')}`,
      senderId: 'student_a',
      type: 'TEXT',
      content: `消息 ${40 - index}`,
      interviewInvitationId: null,
      createdAt,
    }));
    prisma.jobConversationMessage.findMany.mockResolvedValueOnce(firstPage);

    const firstResult = await service.listMessages('student_a', 'conversation_a');
    const decodedCursor = JSON.parse(Buffer.from(firstResult.nextCursor ?? '', 'base64url').toString('utf8'));
    expect(decodedCursor).toEqual({
      createdAt: createdAt.toISOString(),
      id: 'message_11',
    });

    prisma.jobConversationMessage.findMany.mockResolvedValueOnce([]);
    await service.listMessages('student_a', 'conversation_a', firstResult.nextCursor ?? '');

    expect(prisma.jobConversationMessage.findMany).toHaveBeenLastCalledWith({
      where: {
        conversationId: 'conversation_a',
        OR: [
          { createdAt: { lt: createdAt } },
          { createdAt, id: { lt: 'message_11' } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
    });
  });

  it('应继续兼容旧版 ISO 时间游标', async () => {
    const { service, prisma } = buildService();
    const cursor = '2026-08-27T00:01:00.000Z';

    await service.listMessages('student_a', 'conversation_a', cursor);

    expect(prisma.jobConversationMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId: 'conversation_a',
          createdAt: { lt: new Date(cursor) },
        },
      }),
    );
  });
});

describe('JobService 联系方式可见性', () => {
  const post = {
    id: 'post_a',
    merchantId: 'merchant_a',
    title: '校园活动助理',
    description: '协助活动执行',
    requirements: '认真负责',
    contactPhoneSnapshot: '13800000000',
    contactWechatSnapshot: 'campus-job',
    salary: '150元/天',
    salaryAmount: 150,
    location: '大学生活动中心',
    category: null,
    settlement: null,
    workDates: [],
    workPeriods: [],
    headcount: 2,
    urgent: false,
    online: false,
    questions: [],
    duration: JobDuration.D30,
    expireAt: new Date('2026-09-30T00:00:00.000Z'),
    status: JobPostStatus.PUBLISHED,
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
    merchant: {
      userId: 'merchant_user_a',
      shopName: '校园服务站',
      contactPhone: '13900000000',
      contactWechat: 'merchant-wechat',
    },
  };

  function buildJobService() {
    const prisma = {
      jobPost: {
        findUnique: jest.fn().mockResolvedValue(post),
        findFirst: jest.fn().mockResolvedValue({ id: post.id }),
      },
    };
    return {
      service: new JobService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
        {
          resolveFeedCommunityId: jest.fn().mockResolvedValue('community_a'),
          buildVisibleJobPostFilters: jest.fn().mockReturnValue([
            { OR: [{ visibilityScope: 'ALL_COMMUNITIES' }, { communityId: 'community_a' }] },
            { OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }] },
          ]),
        } as never,
        new JobVisibilityPolicyService(),
        new TutorJobPolicyService(),
      ),
      prisma,
    };
  }

  it('普通用户查看公开岗位详情时不应返回完整联系方式', async () => {
    const { service } = buildJobService();
    await expect(service.getPost('post_a', 'student_a')).resolves.toMatchObject({
      contactPhone: null,
      contactWechat: null,
    });
  });

  it('岗位所属商家查看详情时应返回发岗快照联系方式', async () => {
    const { service } = buildJobService();
    await expect(service.getPost('post_a', 'merchant_user_a')).resolves.toMatchObject({
      contactPhone: '13800000000',
      contactWechat: 'campus-job',
    });
  });
});

describe('MerchantService 候选人基本信息', () => {
  it('无简历报名仍应返回真实用户基本信息，并明确保持 resume=null', async () => {
    const createdAt = new Date('2026-08-27T08:00:00.000Z');
    const prisma = {
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'application_without_resume',
          status: AppStatus.PENDING,
          createdAt,
          contactedAt: null,
          fitMark: null,
          resumeId: null,
          resumeSnapshot: null,
          answers: null,
          user: {
            id: 'student_without_resume',
            nickname: '林同学',
            avatarUrl: 'https://example.com/avatar.png',
          },
          jobPost: {
            id: 'post_a',
            merchantId: 'merchant_a',
            title: '校园活动助理',
            description: '协助活动执行',
            requirements: null,
            salary: '150元/天',
            location: '大学生活动中心',
            category: null,
            settlement: null,
            workDates: [],
            workPeriods: [],
            headcount: 2,
            urgent: false,
            online: false,
            questions: [],
            expireAt: new Date('2026-09-30T00:00:00.000Z'),
            status: JobPostStatus.PUBLISHED,
          },
        }),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'merchant_a' }),
      },
      resume: {
        findUnique: jest.fn(),
      },
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new MerchantService(prisma as never, {} as never);

    await expect(service.getCandidateDetail('merchant_user_a', 'application_without_resume')).resolves.toMatchObject({
      user: {
        id: 'student_without_resume',
        nickname: '林同学',
        avatarUrl: 'https://example.com/avatar.png',
      },
      resume: null,
    });
    expect(prisma.resume.findUnique).not.toHaveBeenCalled();
  });
});

describe('PaymentService 岗位发布联系方式快照', () => {
  it('支付发布时应使用商家最新联系方式覆盖草稿快照', async () => {
    const order = {
      id: 'order_a',
      scene: PayScene.JOB_PUBLISH,
      status: PayStatus.PENDING,
      duration: JobDuration.D30,
      merchantId: 'merchant_a',
      jobPostId: 'post_a',
      wxTransactionId: null,
    };
    const paymentUpdate = Promise.resolve({ id: order.id });
    const postUpdate = Promise.resolve({ id: order.jobPostId });
    const prisma = {
      paymentOrder: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockReturnValue(paymentUpdate),
      },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          contactPhone: '13900000000',
          contactWechat: 'latest-wechat',
        }),
      },
      jobPost: {
        update: jest.fn().mockReturnValue(postUpdate),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockResolvedValue([{ id: order.id }, { id: order.jobPostId }]),
    };
    const service = new PaymentService(
      prisma as never,
      {} as never,
      {} as never,
      { create: jest.fn() } as never,
      {} as never,
      {} as never,
    );

    await service.fulfillOrder(order.id);

    expect(prisma.merchant.findUnique).toHaveBeenCalledWith({
      where: { id: order.merchantId },
      select: { contactPhone: true, contactWechat: true },
    });
    expect(prisma.jobPost.update).toHaveBeenCalledWith({
      where: { id: order.jobPostId },
      data: expect.objectContaining({
        status: JobPostStatus.PUBLISHED,
        contactPhoneSnapshot: '13900000000',
        contactWechatSnapshot: 'latest-wechat',
      }),
    });
  });
});
