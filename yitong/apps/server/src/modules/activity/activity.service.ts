import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ActivityEnrollmentStatus,
  ActivityFormat,
  ActivityInfoVisibility,
  ActivityInterestState,
  ActivityJoinMode,
  ActivityReminderKind,
  ActivityScope,
  ActivityStatus,
  CommunityMemberRole,
  CommunityStatus,
  Prisma,
  type Activity,
  type ActivityEnrollment,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import { PublicationPolicyService } from '../publication/publication-policy.service';
import { LarkSyncService } from './lark-sync.service';
import {
  activityChatGroupId,
  type ActivityDetailVo,
  type ActivityEnrollmentVo,
  type ActivityFormData,
  type ActivityFormField,
  type ActivityListVo,
} from './types';
import type {
  CreateActivityDto,
  CreateLarkConnectionDto,
  EnrollActivityDto,
  RemindDto,
  ReviewEnrollmentDto,
  SetActivityAdminsDto,
  SetInterestDto,
  SetLarkConfigDto,
  TransferInitiatorDto,
  UpdateActivityDto,
  UpdateEnrollmentDto,
} from './dto';

// 活动模块业务错误码段（7xxxx；4xxxx 复用通用状态流转段）
const ERR = {
  NOT_FOUND: [70001, '活动不存在'] as const,
  NOT_ENROLLABLE: [70002, '当前活动不可报名'] as const,
  ALREADY_ENROLLED: [70003, '你已有报名记录，可返回修改报名资料'] as const,
  ENROLL_REVOKED: [70004, '你的参与资格已被取消，不能再次报名该活动'] as const,
  ENROLL_NOT_FOUND: [70005, '报名记录不存在'] as const,
  FORM_INVALID: (msg: string) => [70006, msg] as const,
  STATUS_INVALID: (msg: string) => [40004, msg] as const,
  INITIATOR_ONLY: [70007, '该操作仅活动发起人可执行', HttpStatus.FORBIDDEN] as const,
  MANAGER_REQUIRED: [70008, '该操作仅活动发起人或活动管理员可执行', HttpStatus.FORBIDDEN] as const,
  SCOPE_INVALID: [70009, '只能向自己管理的圈子发布活动', HttpStatus.FORBIDDEN] as const,
  COMMUNITY_REQUIRED: [70010, '请选择活动所属圈子', HttpStatus.FORBIDDEN] as const,
  FORMAT_FIELD_MISSING: (msg: string) => [70011, msg] as const,
  CONNECTION_NOT_FOUND: [70012, '飞书连接不存在', HttpStatus.NOT_FOUND] as const,
  CONNECTION_IN_USE: [70013, '该飞书连接已被活动使用，不能删除'] as const,
  REMIND_RATE_LIMITED: [70014, '部分用户 24 小时内已收到过提醒，本次已跳过'] as const,
  NOT_APPROVED_MEMBER: [70015, '仅正式参与人可使用活动群聊', HttpStatus.FORBIDDEN] as const,
  CHAT_READONLY: [70016, '活动群聊已转为只读', HttpStatus.FORBIDDEN] as const,
  TRANSFER_INVALID: [70017, '转让目标必须是活动管理员或平台/圈子管理员', HttpStatus.FORBIDDEN] as const,
};

const FIELD_TYPES = ['text', 'textarea', 'radio', 'checkbox', 'date', 'phone', 'wechat', 'image'] as const;
type FieldType = (typeof FIELD_TYPES)[number];

// 展示中的有效状态（上新弹窗/发现列表口径：可报名）
const ACTIVE_DISPLAY_STATUSES = [ActivityStatus.PUBLISHED];

// 状态集合（显式类型，供 includes 判定）
const SUBMITTABLE_STATUSES: ActivityEnrollmentStatus[] = [ActivityEnrollmentStatus.PENDING_REVIEW, ActivityEnrollmentStatus.APPROVED, ActivityEnrollmentStatus.WAITLIST];
const EDITABLE_ENROLL_STATUSES: ActivityEnrollmentStatus[] = [ActivityEnrollmentStatus.PENDING_REVIEW, ActivityEnrollmentStatus.APPROVED, ActivityEnrollmentStatus.WAITLIST, ActivityEnrollmentStatus.REJECTED];
const REREVIEW_HOLD_STATUSES: ActivityEnrollmentStatus[] = [ActivityEnrollmentStatus.APPROVED, ActivityEnrollmentStatus.WAITLIST];
const CLOSED_ACTIVITY_STATUSES: ActivityStatus[] = [ActivityStatus.CANCELLED, ActivityStatus.ENDED, ActivityStatus.DELISTED];
const ACTIVE_LIFECYCLE: ActivityStatus[] = [ActivityStatus.PUBLISHED, ActivityStatus.UPCOMING, ActivityStatus.ONGOING];

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly moderation: ModerationService,
    private readonly chat: ChatService,
    private readonly publicationPolicy: PublicationPolicyService,
    private readonly larkSync: LarkSyncService,
  ) {}

  // ===== 权限 =====

  /** 用户可发布范围：platform = 平台管理员（全圈可见）；ids = 自己管理的圈子集合（圈主/圈管理员/管理端授权） */
  private async publishScope(uid: string): Promise<{ platform: boolean; managed: Set<string> }> {
    const platform = await this.publicationPolicy.isPlatformUser(uid);
    const [memberships, consoleScope] = await Promise.all([
      this.prisma.communityMember.findMany({
        where: { userId: uid, role: { in: [CommunityMemberRole.OWNER, CommunityMemberRole.ADMIN] } },
        select: { communityId: true },
      }),
      this.consoleCircleAdminScope(uid),
    ]);
    const managed = new Set(memberships.map((m) => m.communityId));
    if (consoleScope) {
      if (consoleScope.all) {
        const all = await this.prisma.community.findMany({
          where: { status: CommunityStatus.ACTIVE, deletedAt: null },
          select: { id: true },
        });
        all.forEach((c) => managed.add(c.id));
      } else {
        consoleScope.ids.forEach((id) => managed.add(id));
      }
    }
    return { platform, managed };
  }

  /** 发布范围查询（发布页渲染依据）：与 create/update 同一判定口径，平台管理员在用户角色下也可正确识别 */
  async getPublishScope(uid: string): Promise<{ platform: boolean; communities: Array<{ id: string; name: string }> }> {
    const { platform, managed } = await this.publishScope(uid);
    const ids = [...managed];
    const communities = ids.length
      ? await this.prisma.community.findMany({
        where: { id: { in: ids }, status: CommunityStatus.ACTIVE, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      })
      : [];
    return { platform, communities };
  }

  // 与 community.service.consoleCircleAdminScope 同套口径（管理端非平台类型管理员的圈子授权）
  private async consoleCircleAdminScope(uid: string): Promise<{ all: boolean; ids: Set<string> } | null> {    const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { openid: true } });
    if (!user?.openid) return null;
    const admin = await this.prisma.adminUser.findFirst({
      where: { openid: user.openid, adminType: { active: true, deletedAt: null, isPlatform: false } },
      select: { id: true, allCommunities: true },
    });
    if (!admin) return null;
    const scopes = await this.prisma.adminCommunityScope.findMany({
      where: { adminUserId: admin.id },
      select: { communityId: true },
    });
    return { all: admin.allCommunities, ids: new Set(scopes.map((s) => s.communityId)) };
  }

  /** 发起人或活动管理员（BR-009/BR-010 的管理者口径） */
  private async isActivityManager(activityId: string, initiatorId: string, uid: string): Promise<boolean> {
    if (uid === initiatorId) return true;
    const admin = await this.prisma.activityAdmin.findUnique({
      where: { activityId_userId: { activityId, userId: uid } },
      select: { id: true },
    });
    return !!admin;
  }

  private async getOrThrow(id: string): Promise<Activity> {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    return activity;
  }

  private async assertManager(activity: Activity, uid: string): Promise<void> {
    if (!(await this.isActivityManager(activity.id, activity.initiatorId, uid))) {
      throw new BizException(...ERR.MANAGER_REQUIRED);
    }
  }

  private async assertInitiator(activity: Activity, uid: string): Promise<void> {
    if (activity.initiatorId !== uid) throw new BizException(...ERR.INITIATOR_ONLY);
  }

  // ===== 表单 =====

  /** 生成/规范表单结构：补 key、排序、选项去空（产生报名前可自由改） */
  private normalizeForm(fields: Array<{
    key?: string;
    type: string;
    label?: string;
    required?: boolean;
    placeholder?: string;
    options?: string[];
    order?: number;
  }> | undefined): ActivityFormField[] {
    const list = (fields ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return list.map((f, idx) => ({
      key: f.key || `f_${Math.random().toString(36).slice(2, 10)}`,
      type: (FIELD_TYPES.includes(f.type as FieldType) ? f.type : 'text') as ActivityFormField['type'],
      label: (f.label ?? '').trim(),
      required: !!f.required,
      placeholder: f.placeholder?.trim() || undefined,
      options: (f.type === 'radio' || f.type === 'checkbox')
        ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
        : undefined,
      order: idx,
    }));
  }

  /** Json 列写入辅助：null → DbNull，对象 → InputJsonValue */
  private static json<T>(v: T | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    return v === null ? Prisma.DbNull : (v as unknown as Prisma.InputJsonValue);
  }

  /** Prisma Json 列读取还原为表单结构（Json 值类型宽，统一 unknown 中转） */
  private readForm(activity: Activity): ActivityFormField[] {
    return activity.form as unknown as ActivityFormField[];
  }

  /** 产生报名后表单结构锁定：不可删字段/改类型/改选项含义；可改说明、排序、新增选填字段（AC-026） */
  private assertFormEditable(oldForm: ActivityFormField[], newForm: ActivityFormField[]): void {
    const oldMap = new Map(oldForm.map((f) => [f.key, f]));
    const newMap = new Map(newForm.map((f) => [f.key, f]));
    for (const old of oldForm) {
      const next = newMap.get(old.key);
      if (!next) {
        throw new BizException(...ERR.FORM_INVALID(`已产生报名，不能删除字段「${old.label}」`));
      }
      if (next.type !== old.type) {
        throw new BizException(...ERR.FORM_INVALID(`已产生报名，不能修改字段「${old.label}」的类型`));
      }
      if (old.options && next.options) {
        const nextSet = new Set(next.options);
        for (const opt of old.options) {
          if (!nextSet.has(opt)) {
            throw new BizException(...ERR.FORM_INVALID(`已产生报名，不能修改或删除字段「${old.label}」的既有选项`));
          }
        }
      }
    }
    for (const next of newForm) {
      if (!oldMap.has(next.key) && next.required) {
        throw new BizException(...ERR.FORM_INVALID('已产生报名，新增字段只能为选填'));
      }
    }
  }

  /** 报名资料校验：必填、类型（手机号/微信号正则、选项值域、日期格式），返回规范后的数据 */
  private validateFormData(
    form: ActivityFormField[],
    raw: Record<string, unknown>,
  ): ActivityFormData {
    const data: ActivityFormData = {};
    for (const field of form) {
      const value = raw[field.key];
      const isEmpty
        = value === undefined || value === null || value === ''
          || (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        if (field.required) throw new BizException(...ERR.FORM_INVALID(`请填写「${field.label}」`));
        continue;
      }
      if (field.type === 'checkbox' || field.type === 'image') {
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
          throw new BizException(...ERR.FORM_INVALID(`「${field.label}」格式不正确`));
        }
        const arr = (value as string[]).filter(Boolean);
        if (field.required && arr.length === 0) throw new BizException(...ERR.FORM_INVALID(`请填写「${field.label}」`));
        if (field.type === 'image' && arr.length > 9) {
          throw new BizException(...ERR.FORM_INVALID(`「${field.label}」最多 9 张图片`));
        }
        if (field.type === 'checkbox') {
          const allowed = new Set(field.options ?? []);
          for (const v of arr) {
            if (!allowed.has(v)) throw new BizException(...ERR.FORM_INVALID(`「${field.label}」包含无效选项`));
          }
        }
        data[field.key] = arr;
      } else {
        if (typeof value !== 'string') throw new BizException(...ERR.FORM_INVALID(`「${field.label}」格式不正确`));
        const str = value.trim();
        if (!str) {
          if (field.required) throw new BizException(...ERR.FORM_INVALID(`请填写「${field.label}」`));
          continue;
        }
        if (field.type === 'radio' && !(field.options ?? []).includes(str)) {
          throw new BizException(...ERR.FORM_INVALID(`「${field.label}」包含无效选项`));
        }
        if (field.type === 'phone' && !/^1\d{10}$/.test(str)) {
          throw new BizException(...ERR.FORM_INVALID(`「${field.label}」格式不正确`));
        }
        if (field.type === 'wechat' && !/^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(str)) {
          throw new BizException(...ERR.FORM_INVALID(`「${field.label}」格式不正确`));
        }
        if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          throw new BizException(...ERR.FORM_INVALID(`「${field.label}」格式不正确`));
        }
        if (str.length > 1000) throw new BizException(...ERR.FORM_INVALID(`「${field.label}」内容过长`));
        data[field.key] = str;
      }
    }
    return data;
  }

  // ===== 创建 / 编辑 / 生命周期 =====

  private parseDate(value: string | undefined, label: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new BizException(...ERR.FORM_INVALID(`${label} 时间格式不正确`));
    return d;
  }

  /** 活动形式字段约束（AC-036）+ 时间钳制（报名截止默认不晚于活动开始） */
  private validateBusinessFields(input: {
    format: string;
    location?: string;
    joinLink?: string;
    startTime: Date | null;
    endTime: Date | null;
    enrollStartAt: Date | null;
    enrollEndAt: Date | null;
  }): void {
    const format = input.format as ActivityFormat;
    if ((format === ActivityFormat.OFFLINE || format === ActivityFormat.HYBRID) && !input.location?.trim()) {
      throw new BizException(...ERR.FORMAT_FIELD_MISSING('线下或线上线下结合活动必须填写活动地点'));
    }
    if ((format === ActivityFormat.ONLINE || format === ActivityFormat.HYBRID) && !input.joinLink?.trim()) {
      throw new BizException(...ERR.FORMAT_FIELD_MISSING('线上或线上线下结合活动必须填写参与方式或链接'));
    }
    if (input.startTime && input.endTime && input.endTime < input.startTime) {
      throw new BizException(...ERR.STATUS_INVALID('活动结束时间不能早于开始时间'));
    }
  }

  private clampEnrollEnd(
    enrollEndAt: Date | null,
    startTime: Date | null,
  ): Date | null {
    if (enrollEndAt && startTime && enrollEndAt > startTime) return startTime;
    return enrollEndAt;
  }

  async create(uid: string, dto: CreateActivityDto): Promise<ActivityDetailVo> {
    const scopeInfo = await this.publishScope(uid);
    let scope: ActivityScope;
    let communityId: string | null = null;
    if (dto.communityId) {
      if (!scopeInfo.managed.has(dto.communityId)) throw new BizException(...ERR.SCOPE_INVALID);
      scope = ActivityScope.COMMUNITY;
      communityId = dto.communityId;
    } else {
      if (!scopeInfo.platform) throw new BizException(...ERR.COMMUNITY_REQUIRED);
      scope = ActivityScope.PLATFORM;
    }
    await this.moderation.checkText(`${dto.title}\n${dto.description}`);

    const startTime = this.parseDate(dto.startTime, '活动开始');
    const endTime = this.parseDate(dto.endTime, '活动结束');
    const enrollStartAt = this.parseDate(dto.enrollStartAt, '报名开始');
    let enrollEndAt = this.parseDate(dto.enrollEndAt, '报名截止');
    this.validateBusinessFields({ format: dto.format, location: dto.location, joinLink: dto.joinLink, startTime, endTime, enrollStartAt, enrollEndAt });
    enrollEndAt = this.clampEnrollEnd(enrollEndAt, startTime);

    const publish = !!dto.publish;
    const activity = await this.prisma.activity.create({
      data: {
        scope,
        communityId,
        title: dto.title.trim(),
        coverImage: dto.coverImage,
        description: dto.description,
        format: dto.format as ActivityFormat,
        location: dto.location?.trim() || null,
        joinLink: dto.joinLink?.trim() || null,
        infoVisibility: (dto.infoVisibility as ActivityInfoVisibility) ?? ActivityInfoVisibility.PUBLIC,
        startTime,
        endTime,
        enrollStartAt,
        enrollEndAt,
        joinMode: dto.joinMode as ActivityJoinMode,
        capacity: dto.capacity ?? null,
        form: this.normalizeForm(dto.form) as unknown as Prisma.InputJsonValue,
        status: publish ? ActivityStatus.PUBLISHED : ActivityStatus.DRAFT,
        initiatorId: uid,
        publishedAt: publish ? new Date() : null,
      },
    });
    return this.detail(uid, activity.id);
  }

  async update(uid: string, id: string, dto: UpdateActivityDto): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    await this.moderation.checkText(`${dto.title}\n${dto.description}`);

    const startTime = this.parseDate(dto.startTime, '活动开始');
    const endTime = this.parseDate(dto.endTime, '活动结束');
    const enrollStartAt = this.parseDate(dto.enrollStartAt, '报名开始');
    let enrollEndAt = this.parseDate(dto.enrollEndAt, '报名截止');
    this.validateBusinessFields({ format: dto.format, location: dto.location, joinLink: dto.joinLink, startTime, endTime, enrollStartAt, enrollEndAt });
    enrollEndAt = this.clampEnrollEnd(enrollEndAt, startTime);

    const oldForm = this.readForm(activity);
    const newForm = this.normalizeForm(dto.form);
    const hasEnrollments = await this.prisma.activityEnrollment.count({ where: { activityId: id } }) > 0;
    if (hasEnrollments) this.assertFormEditable(oldForm, newForm);

    const importantChanged =
      activity.status !== ActivityStatus.DRAFT
      && (activity.startTime?.getTime() !== startTime?.getTime()
        || activity.endTime?.getTime() !== endTime?.getTime()
        || activity.location !== (dto.location?.trim() || null)
        || activity.joinLink !== (dto.joinLink?.trim() || null));

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        coverImage: dto.coverImage,
        description: dto.description,
        format: dto.format as ActivityFormat,
        location: dto.location?.trim() || null,
        joinLink: dto.joinLink?.trim() || null,
        infoVisibility: (dto.infoVisibility as ActivityInfoVisibility) ?? activity.infoVisibility,
        startTime,
        endTime,
        enrollStartAt,
        enrollEndAt,
        joinMode: dto.joinMode as ActivityJoinMode,
        capacity: dto.capacity ?? null,
        form: newForm as unknown as Prisma.InputJsonValue,
      },
    });

    if (importantChanged) {
      void this.notifyParticipants(id, updated, NotificationType.ACTIVITY_INFO_CHANGED, '活动信息变更', '你报名的活动信息有更新，请查看最新详情');
    }
    return this.detail(uid, id);
  }

  async publish(uid: string, id: string): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    if (activity.status !== ActivityStatus.DRAFT) {
      throw new BizException(...ERR.STATUS_INVALID('只有草稿状态的活动可以发布'));
    }
    await this.prisma.activity.update({
      where: { id },
      data: { status: ActivityStatus.PUBLISHED, publishedAt: new Date() },
    });
    return this.detail(uid, id);
  }

  /** 取消整个活动（仅发起人，AC-028）：停报名/停候补转正/群聊立即只读/通知参与人/同步飞书 */
  async cancel(uid: string, id: string): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertInitiator(activity, uid);
    if (!ACTIVE_LIFECYCLE.includes(activity.status)) {
      throw new BizException(...ERR.STATUS_INVALID('当前状态的活动不能取消'));
    }
    await this.prisma.activity.update({
      where: { id },
      data: { status: ActivityStatus.CANCELLED, chatReadonlyAt: new Date() },
    });
    void this.notifyParticipants(
      id,
      activity,
      NotificationType.ACTIVITY_CANCELLED,
      '活动已取消',
      `活动「${activity.title}」已被取消，详见活动详情`,
      [ActivityEnrollmentStatus.APPROVED, ActivityEnrollmentStatus.WAITLIST, ActivityEnrollmentStatus.PENDING_REVIEW],
    );
    void this.larkSync.markAllPending(id);
    return this.detail(uid, id);
  }

  /** 下架（仅发起人）：停止展示与报名，保留记录（BR-012） */
  async delist(uid: string, id: string): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertInitiator(activity, uid);
    if (activity.status === ActivityStatus.DELISTED || activity.status === ActivityStatus.CANCELLED) {
      throw new BizException(...ERR.STATUS_INVALID('当前状态的活动不能下架'));
    }
    await this.prisma.activity.update({ where: { id }, data: { status: ActivityStatus.DELISTED } });
    return this.detail(uid, id);
  }

  /** 手动结束（发起人/管理员）：长期活动等无结束时间场景的收尾，群聊 7 天后只读（AC-031） */
  async finish(uid: string, id: string): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    if (!ACTIVE_LIFECYCLE.includes(activity.status)) {
      throw new BizException(...ERR.STATUS_INVALID('当前状态的活动不能结束'));
    }
    await this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.ENDED,
        endTime: activity.endTime ?? new Date(),
        chatReadonlyAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    return this.detail(uid, id);
  }

  /** 转让发起人（仅发起人，BR-009）：目标须是活动管理员或平台/圈子管理员；原发起人转为活动管理员 */
  async transferInitiator(uid: string, id: string, dto: TransferInitiatorDto): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertInitiator(activity, uid);
    if (dto.targetUserId === uid) throw new BizException(...ERR.STATUS_INVALID('不能转让给自己'));
    const isManager = await this.isActivityManager(id, activity.initiatorId, dto.targetUserId);
    const scopeInfo = await this.publishScope(dto.targetUserId);
    const inScope = activity.scope === ActivityScope.PLATFORM
      ? scopeInfo.platform
      : scopeInfo.managed.has(activity.communityId ?? '');
    if (!isManager && !inScope) throw new BizException(...ERR.TRANSFER_INVALID);
    await this.prisma.$transaction([
      this.prisma.activity.update({ where: { id }, data: { initiatorId: dto.targetUserId } }),
      this.prisma.activityAdmin.upsert({
        where: { activityId_userId: { activityId: id, userId: uid } },
        update: {},
        create: { activityId: id, userId: uid },
      }),
    ]);
    return this.detail(uid, id);
  }

  /** 增删活动管理员（仅发起人，BR-009） */
  async setAdmins(uid: string, id: string, dto: SetActivityAdminsDto): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertInitiator(activity, uid);
    const users = dto.add?.length
      ? await this.prisma.user.findMany({
        where: { id: { in: dto.add }, deletedAt: null },
        select: { id: true },
      })
      : [];
    await this.prisma.$transaction(async (tx) => {
      if (dto.remove?.length) {
        await tx.activityAdmin.deleteMany({
          where: { activityId: id, userId: { in: dto.remove.filter((u) => u !== activity.initiatorId) } },
        });
      }
      for (const u of users) {
        await tx.activityAdmin.upsert({
          where: { activityId_userId: { activityId: id, userId: u.id } },
          update: {},
          create: { activityId: id, userId: u.id },
        });
      }
    });
    return this.detail(uid, id);
  }

  async setLarkConfig(uid: string, id: string, dto: SetLarkConfigDto): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    await this.assertInitiator(activity, uid);
    const conn = await this.prisma.larkConnection.findUnique({ where: { id: dto.connectionId } });
    if (!conn || conn.ownerId !== uid) throw new BizException(...ERR.CONNECTION_NOT_FOUND);
    await this.prisma.activity.update({
      where: { id },
      data: { larkConnectionId: conn.id, larkBitableApp: dto.bitableApp, larkBitableTable: dto.bitableTable },
    });
    return this.detail(uid, id);
  }

  // ===== 报名 / 审核 / 候补 =====

  private enrollWindowOpen(activity: Activity, now = new Date()): boolean {
    if (activity.status !== ActivityStatus.PUBLISHED) return false;
    if (activity.enrollStartAt && now < activity.enrollStartAt) return false;
    const deadline = activity.enrollEndAt ?? activity.startTime;
    if (deadline && now >= deadline) return false;
    return true;
  }

  private async counts(activityId: string): Promise<{ approved: number; pending: number; waitlist: number }> {
    const grouped = await this.prisma.activityEnrollment.groupBy({
      by: ['status'],
      where: { activityId },
      _count: { _all: true },
    });
    const get = (s: ActivityEnrollmentStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
    return { approved: get(ActivityEnrollmentStatus.APPROVED), pending: get(ActivityEnrollmentStatus.PENDING_REVIEW), waitlist: get(ActivityEnrollmentStatus.WAITLIST) };
  }

  private async hasSlot(activity: Activity): Promise<boolean> {
    if (activity.capacity === null) return true;
    const { approved } = await this.counts(activity.id);
    return approved < activity.capacity;
  }

  /** 报名（含重新报名）：直接型立即占位/候补，审核型进入待审核（AC-007/008/009） */
  async enroll(uid: string, id: string, dto: EnrollActivityDto): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    if (activity.status === ActivityStatus.DRAFT) throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!this.enrollWindowOpen(activity)) throw new BizException(...ERR.NOT_ENROLLABLE);

    const existing = await this.prisma.activityEnrollment.findUnique({
      where: { activityId_userId: { activityId: id, userId: uid } },
    });
    if (existing) {
      if (existing.status === ActivityEnrollmentStatus.REVOKED) throw new BizException(...ERR.ENROLL_REVOKED, HttpStatus.FORBIDDEN);
      if (SUBMITTABLE_STATUSES.includes(existing.status)) {
        throw new BizException(...ERR.ALREADY_ENROLLED);
      }
    }

    const form = this.readForm(activity);
    const data = this.validateFormData(form, dto.data);
    // 内容安全：文本字段 checkText、图片字段 checkImage（红线：用户输入内联审核）
    const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { openid: true } });
    for (const field of form) {
      const value = data[field.key];
      if (value === undefined) continue;
      if (field.type === 'image') {
        for (const url of value as string[]) await this.moderation.checkImage(url);
      } else if (typeof value === 'string' && ['text', 'textarea'].includes(field.type)) {
        await this.moderation.checkText(value, user?.openid);
      }
    }

    const now = new Date();
    const isReview = activity.joinMode === ActivityJoinMode.REVIEW;
    const directApprove = !isReview && (await this.hasSlot(activity));
    const status = isReview
      ? ActivityEnrollmentStatus.PENDING_REVIEW
      : directApprove ? ActivityEnrollmentStatus.APPROVED : ActivityEnrollmentStatus.WAITLIST;

    const enrollment = await this.prisma.activityEnrollment.upsert({
      where: { activityId_userId: { activityId: id, userId: uid } },
      update: {
        status,
        data,
        approvedData: ActivityService.json(status === ActivityEnrollmentStatus.APPROVED ? data : null),
        pendingData: Prisma.DbNull,
        waitlistedAt: status === ActivityEnrollmentStatus.WAITLIST ? now : null,
        reviewedAt: null,
        reviewedBy: null,
        revokedReason: null,
      },
      create: {
        activityId: id,
        userId: uid,
        status,
        data,
        approvedData: ActivityService.json(status === ActivityEnrollmentStatus.APPROVED ? data : null),
        waitlistedAt: status === ActivityEnrollmentStatus.WAITLIST ? now : null,
      },
    });

    if (status === ActivityEnrollmentStatus.APPROVED) {
      await this.notifyOne(uid, NotificationType.ACTIVITY_ENROLL_SUCCESS, '报名成功', `你已成功报名「${activity.title}」`, id);
    } else if (status === ActivityEnrollmentStatus.WAITLIST) {
      await this.notifyOne(uid, NotificationType.ACTIVITY_WAITLISTED, '进入候补', `「${activity.title}」名额已满，你已进入候补队列`, id);
    } else {
      await this.notifyManagers(id, activity, '有新报名待审核', `「${activity.title}」有新的报名待审核`);
    }
    void this.larkSync.markPending(id, enrollment.id).catch(() => undefined);
    return this.detail(uid, id);
  }

  /** 修改报名资料：未审核继续保持待审核；已通过用户保留资格、新资料进入复审（AC-024） */
  async updateMyEnrollment(uid: string, id: string, dto: UpdateEnrollmentDto): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    const enrollment = await this.prisma.activityEnrollment.findUnique({
      where: { activityId_userId: { activityId: id, userId: uid } },
    });
    if (!enrollment) throw new BizException(...ERR.ENROLL_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!EDITABLE_ENROLL_STATUSES.includes(enrollment.status)) {
      throw new BizException(...ERR.STATUS_INVALID('当前报名状态不能修改资料'));
    }
    // 报名截止前可修改（REJECTED 重新提交同样受限）
    if (!this.enrollWindowOpen(activity)) throw new BizException(...ERR.NOT_ENROLLABLE);

    const form = this.readForm(activity);
    const data = this.validateFormData(form, dto.data);
    const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { openid: true } });
    for (const field of form) {
      const value = data[field.key];
      if (value === undefined) continue;
      if (field.type === 'image') {
        for (const url of value as string[]) await this.moderation.checkImage(url);
      } else if (typeof value === 'string' && ['text', 'textarea'].includes(field.type)) {
        await this.moderation.checkText(value, user?.openid);
      }
    }

    if (activity.joinMode === ActivityJoinMode.REVIEW
      && REREVIEW_HOLD_STATUSES.includes(enrollment.status)) {
      // 已通过/候补：资格与名额不变，新资料挂 pendingData 待复审
      await this.prisma.activityEnrollment.update({
        where: { id: enrollment.id },
        data: { pendingData: ActivityService.json(data) },
      });
      await this.notifyManagers(id, activity, '有报名资料修改待复审', `「${activity.title}」有参与人修改了报名资料，待复审`);
    } else {
      // 未审核（PENDING_REVIEW/REJECTED 修改后重新进入待审核）或直接报名型：直接更新 data
      await this.prisma.activityEnrollment.update({
        where: { id: enrollment.id },
        data: {
          data,
          status: activity.joinMode === ActivityJoinMode.REVIEW
            ? ActivityEnrollmentStatus.PENDING_REVIEW
            : enrollment.status,
          approvedData: ActivityService.json(activity.joinMode === ActivityJoinMode.REVIEW ? null : enrollment.approvedData),
        },
      });
      if (activity.joinMode === ActivityJoinMode.REVIEW) {
        await this.notifyManagers(id, activity, '报名资料已更新', `「${activity.title}」待审核报名的资料已更新`);
      }
    }
    void this.larkSync.markPending(id, enrollment.id).catch(() => undefined);
    return this.detail(uid, id);
  }

  /** 用户主动取消（AC-022）：正式名额释放 → 候补首位自动转正（AC-010） */
  async cancelMyEnrollment(uid: string, id: string): Promise<ActivityDetailVo> {
    const activity = await this.getOrThrow(id);
    const enrollment = await this.prisma.activityEnrollment.findUnique({
      where: { activityId_userId: { activityId: id, userId: uid } },
    });
    if (!enrollment) throw new BizException(...ERR.ENROLL_NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!EDITABLE_ENROLL_STATUSES.includes(enrollment.status)) {
      throw new BizException(...ERR.STATUS_INVALID('当前报名状态不能取消'));
    }
    const wasApproved = enrollment.status === ActivityEnrollmentStatus.APPROVED;
    await this.prisma.activityEnrollment.update({
      where: { id: enrollment.id },
      data: { status: ActivityEnrollmentStatus.CANCELLED, waitlistedAt: null, pendingData: Prisma.DbNull },
    });
    void this.larkSync.markPending(id, enrollment.id).catch(() => undefined);
    if (wasApproved) await this.promoteWaitlistHead(activity);
    return this.detail(uid, id);
  }

  /** 候补转正：按进入候补时间 FIFO 取第一名 → 正式参与人 + 通知 + 同步（AC-010） */
  private async promoteWaitlistHead(activity: Activity): Promise<void> {
    if (activity.status !== ActivityStatus.PUBLISHED && activity.status !== ActivityStatus.UPCOMING) return; // 取消/结束后停转正
    const head = await this.prisma.activityEnrollment.findFirst({
      where: { activityId: activity.id, status: ActivityEnrollmentStatus.WAITLIST },
      orderBy: { waitlistedAt: 'asc' },
    });
    if (!head) return;
    const { approved } = await this.counts(activity.id);
    if (activity.capacity !== null && approved >= activity.capacity) return;
    // 转正只采纳已审核通过的 data；若 WAITLIST 期间改过资料（pendingData），保留待复审，不静默生效（AC-024）
    const data = head.data as ActivityFormData;
    await this.prisma.activityEnrollment.update({
      where: { id: head.id },
      data: {
        status: ActivityEnrollmentStatus.APPROVED,
        data,
        approvedData: ActivityService.json(data),
        waitlistedAt: null,
        reviewedAt: new Date(),
      },
    });
    await this.notifyOne(head.userId, NotificationType.ACTIVITY_WAITLIST_PROMOTED, '候补转正', `恭喜！你在「${activity.title}」的候补已转正，已自动加入活动群聊`, activity.id);
    void this.larkSync.markPending(activity.id, head.id).catch(() => undefined);
  }

  /** 管理端报名列表：PENDING_REVIEW / APPROVED / WAITLIST / CANCELLED / REVOKED / REJECTED / RE_REVIEW（复审队列） */
  async listEnrollments(uid: string, id: string, status: string, page = 1, pageSize = 20) {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    const where = status === 'RE_REVIEW'
      ? { activityId: id, status: ActivityEnrollmentStatus.APPROVED, NOT: { pendingData: { equals: Prisma.DbNull } } }
      : { activityId: id, status: status as ActivityEnrollmentStatus };
    const [total, list] = await Promise.all([
      this.prisma.activityEnrollment.count({ where }),
      this.prisma.activityEnrollment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: list.map((e) => e.userId) } },
      select: { id: true, nickname: true, avatarUrl: true, phone: true, wechat: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      list: list.map((e) => this.toEnrollmentVo(e, userMap.get(e.userId))),
      total,
      page,
      pageSize,
    };
  }

  private toEnrollmentVo(e: ActivityEnrollment, user?: { nickname: string; avatarUrl: string | null; phone: string | null; wechat: string | null }): ActivityEnrollmentVo {
    return {
      id: e.id,
      userId: e.userId,
      nickname: user?.nickname ?? '已注销用户',
      avatarUrl: user?.avatarUrl ?? null,
      phone: user?.phone ?? null,
      wechat: user?.wechat ?? null,
      status: e.status,
      data: e.data as ActivityFormData,
      pendingData: (e.pendingData as ActivityFormData | null) ?? null,
      waitlistedAt: e.waitlistedAt?.toISOString() ?? null,
      revokedReason: e.revokedReason,
      reviewedAt: e.reviewedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  /** 审核通过：首审按名额分流正式/候补（AC-008/009）；复审通过新资料生效 */
  async approve(uid: string, id: string, enrollmentId: string): Promise<void> {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    const enrollment = await this.prisma.activityEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.activityId !== id) throw new BizException(...ERR.ENROLL_NOT_FOUND, HttpStatus.NOT_FOUND);

    if (enrollment.pendingData && enrollment.status === ActivityEnrollmentStatus.APPROVED) {
      // 复审通过：新资料生效（AC-024）
      const data = enrollment.pendingData as ActivityFormData;
      await this.prisma.activityEnrollment.update({
        where: { id: enrollmentId },
        data: { data: data as unknown as Prisma.InputJsonValue, approvedData: ActivityService.json(data), pendingData: Prisma.DbNull, reviewedAt: new Date(), reviewedBy: uid },
      });
      await this.notifyOne(enrollment.userId, NotificationType.ACTIVITY_REVIEW_PASS, '资料复审通过', `你在「${activity.title}」修改的报名资料已通过复审`, id);
      void this.larkSync.markPending(id, enrollmentId).catch(() => undefined);
      return;
    }

    if (enrollment.status !== ActivityEnrollmentStatus.PENDING_REVIEW) {
      throw new BizException(...ERR.STATUS_INVALID('该报名不在待审核状态'));
    }
    const hasSlot = await this.hasSlot(activity);
    const data = enrollment.data as ActivityFormData;
    if (hasSlot) {
      await this.prisma.activityEnrollment.update({
        where: { id: enrollmentId },
        data: { status: ActivityEnrollmentStatus.APPROVED, approvedData: ActivityService.json(data), reviewedAt: new Date(), reviewedBy: uid },
      });
      await this.notifyOne(enrollment.userId, NotificationType.ACTIVITY_REVIEW_PASS, '审核通过', `你在「${activity.title}」的报名已通过，已自动加入活动群聊`, id);
    } else {
      await this.prisma.activityEnrollment.update({
        where: { id: enrollmentId },
        data: { status: ActivityEnrollmentStatus.WAITLIST, waitlistedAt: new Date(), reviewedAt: new Date(), reviewedBy: uid },
      });
      await this.notifyOne(enrollment.userId, NotificationType.ACTIVITY_WAITLISTED, '进入候补', `「${activity.title}」名额已满，审核通过后你已进入候补队列`, id);
    }
    void this.larkSync.markPending(id, enrollmentId).catch(() => undefined);
  }

  /** 拒绝：首审 → REJECTED（可修改后重新提交）；复审拒绝 → 恢复上次通过资料、保留资格（AC-025） */
  async reject(uid: string, id: string, enrollmentId: string, dto: ReviewEnrollmentDto): Promise<void> {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    const enrollment = await this.prisma.activityEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.activityId !== id) throw new BizException(...ERR.ENROLL_NOT_FOUND, HttpStatus.NOT_FOUND);

    if (enrollment.pendingData && REREVIEW_HOLD_STATUSES.includes(enrollment.status)) {
      // 复审拒绝：丢弃新资料，恢复最近一次审核通过的资料（data 本身即上次通过值）
      await this.prisma.activityEnrollment.update({
        where: { id: enrollmentId },
        data: { pendingData: Prisma.DbNull, reviewedAt: new Date(), reviewedBy: uid },
      });
      await this.notifyOne(enrollment.userId, NotificationType.ACTIVITY_REREVIEW_REJECTED, '资料复审未通过', `「${activity.title}」的新资料未通过复审，已恢复上次通过的资料，请重新修改后提交`, id);
      void this.larkSync.markPending(id, enrollmentId).catch(() => undefined);
      return;
    }

    if (enrollment.status !== ActivityEnrollmentStatus.PENDING_REVIEW) {
      throw new BizException(...ERR.STATUS_INVALID('该报名不在待审核状态'));
    }
    await this.prisma.activityEnrollment.update({
      where: { id: enrollmentId },
      data: { status: ActivityEnrollmentStatus.REJECTED, reviewedAt: new Date(), reviewedBy: uid },
    });
    await this.notifyOne(enrollment.userId, NotificationType.ACTIVITY_REVIEW_REJECT, '审核未通过', `你在「${activity.title}」的报名未通过审核${dto.reason ? `：${dto.reason}` : ''}，可修改资料后重新提交`, id);
    void this.larkSync.markPending(id, enrollmentId).catch(() => undefined);
  }

  /** 取消参与资格（必填原因）：退出群聊、通知、不得再次报名；释放名额时候补转正（AC-023 / BR-006） */
  async revoke(uid: string, id: string, enrollmentId: string, reason: string): Promise<void> {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    const enrollment = await this.prisma.activityEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment || enrollment.activityId !== id) throw new BizException(...ERR.ENROLL_NOT_FOUND, HttpStatus.NOT_FOUND);
    const ENDED_ENROLL_STATUSES: ActivityEnrollmentStatus[] = [ActivityEnrollmentStatus.REVOKED, ActivityEnrollmentStatus.CANCELLED];
    if (ENDED_ENROLL_STATUSES.includes(enrollment.status)) {
      throw new BizException(...ERR.STATUS_INVALID('该报名已结束，无需取消资格'));
    }
    const wasApproved = enrollment.status === ActivityEnrollmentStatus.APPROVED;
    await this.prisma.activityEnrollment.update({
      where: { id: enrollmentId },
      data: { status: ActivityEnrollmentStatus.REVOKED, revokedReason: reason, waitlistedAt: null, pendingData: Prisma.DbNull, reviewedAt: new Date(), reviewedBy: uid },
    });
    await this.notifyOne(enrollment.userId, NotificationType.ACTIVITY_REVOKED, '参与资格已取消', `你在「${activity.title}」的参与资格已被取消：${reason}`, id);
    void this.larkSync.markPending(id, enrollmentId).catch(() => undefined);
    if (wasApproved) await this.promoteWaitlistHead(activity);
  }

  // ===== 发现 / 详情 / 我的活动 / 兴趣 =====

  /** 可见范围过滤（AC-034 / BR-001/002）：平台活动全圈可见；圈子活动仅所属圈子 */
  private visibilityFilter(communityId: string | null) {
    return {
      OR: [
        { scope: ActivityScope.PLATFORM },
        ...(communityId ? [{ scope: ActivityScope.COMMUNITY as ActivityScope, communityId }] : []),
      ],
    };
  }

  private async activeCommunityId(uid: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { activeCommunityId: true },
    });
    return user?.activeCommunityId ?? null;
  }

  async list(
    uid: string,
    opts: { status?: string; communityId?: string; limit?: number; includeAll?: boolean },
  ): Promise<{ list: ActivityListVo[] }> {
    const communityId = opts.communityId ?? (await this.activeCommunityId(uid));
    const statuses = opts.status
      ? opts.status.split(',').map((s) => s.trim()).filter(Boolean)
      : [ActivityStatus.PUBLISHED, ActivityStatus.UPCOMING, ActivityStatus.ONGOING, ActivityStatus.ENDED];
    const activities = await this.prisma.activity.findMany({
      where: {
        ...this.visibilityFilter(communityId),
        status: { in: statuses as ActivityStatus[] },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(opts.limit ?? 50, 50),
    });
    const [enrollments, interests] = await Promise.all([
      this.prisma.activityEnrollment.findMany({
        where: { userId: uid, activityId: { in: activities.map((a) => a.id) } },
        select: { activityId: true, status: true },
      }),
      this.prisma.activityInterest.findMany({
        where: { userId: uid, activityId: { in: activities.map((a) => a.id) }, state: ActivityInterestState.INTERESTED },
        select: { activityId: true },
      }),
    ]);
    const statusMap = new Map(enrollments.map((e) => [e.activityId, e.status]));
    const interestSet = new Set(interests.map((i) => i.activityId));
    const communityIds = [...new Set(activities.map((a) => a.communityId).filter((c): c is string => !!c))];
    const communities = communityIds.length
      ? await this.prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true, name: true } })
      : [];
    const nameMap = new Map(communities.map((c) => [c.id, c.name]));
    const countList = await Promise.all(activities.map((a) => this.counts(a.id)));
    return {
      list: activities.map((a, i) => this.toListVo(a, countList[i] ?? { approved: 0, pending: 0, waitlist: 0 }, nameMap.get(a.communityId ?? '') ?? null, statusMap.get(a.id) ?? (interestSet.has(a.id) ? 'INTERESTED' : null))),
    };
  }

  /** 上新弹窗（AC-012~014）：最新可报名 ≤5，排除不感兴趣 */
  async newArrivals(uid: string): Promise<{ list: ActivityListVo[] }> {
    const communityId = await this.activeCommunityId(uid);
    const notInterested = await this.prisma.activityInterest.findMany({
      where: { userId: uid, state: ActivityInterestState.NOT_INTERESTED },
      select: { activityId: true },
    });
    const excluded = new Set(notInterested.map((i) => i.activityId));
    const activities = await this.prisma.activity.findMany({
      where: {
        ...this.visibilityFilter(communityId),
        status: { in: ACTIVE_DISPLAY_STATUSES },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
    const visible = activities.filter((a) => !excluded.has(a.id)).slice(0, 5);
    const countList = await Promise.all(visible.map((a) => this.counts(a.id)));
    const enrollments = visible.length
      ? await this.prisma.activityEnrollment.findMany({
        where: { userId: uid, activityId: { in: visible.map((a) => a.id) } },
        select: { activityId: true, status: true },
      })
      : [];
    const statusMap = new Map(enrollments.map((e) => [e.activityId, e.status]));
    return {
      list: visible.map((a, i) => this.toListVo(a, countList[i] ?? { approved: 0, pending: 0, waitlist: 0 }, null, statusMap.get(a.id) ?? null)),
    };
  }

  private toListVo(
    a: Activity,
    counts: { approved: number; pending: number; waitlist: number },
    communityName: string | null,
    myStatus: string | null,
  ): ActivityListVo {
    return {
      id: a.id,
      scope: a.scope,
      communityId: a.communityId,
      communityName,
      title: a.title,
      coverImage: a.coverImage,
      summary: a.description.replace(/\s+/g, ' ').slice(0, 60),
      format: a.format,
      startTime: a.startTime?.toISOString() ?? null,
      endTime: a.endTime?.toISOString() ?? null,
      enrollEndAt: a.enrollEndAt?.toISOString() ?? null,
      joinMode: a.joinMode,
      capacity: a.capacity,
      approvedCount: counts.approved,
      pendingCount: counts.pending,
      waitlistCount: counts.waitlist,
      status: a.status,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      myStatus,
    };
  }

  async detail(uid: string, id: string): Promise<ActivityDetailVo> {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);

    const [enrollment, interest, adminRows, counts, initiator, isManager, activeCommunityId] = await Promise.all([
      this.prisma.activityEnrollment.findUnique({
        where: { activityId_userId: { activityId: id, userId: uid } },
      }),
      this.prisma.activityInterest.findUnique({
        where: { activityId_userId: { activityId: id, userId: uid } },
      }),
      this.prisma.activityAdmin.findMany({ where: { activityId: id }, select: { userId: true } }),
      this.counts(id),
      this.prisma.user.findUnique({
        where: { id: activity.initiatorId },
        select: { id: true, nickname: true, avatarUrl: true },
      }),
      this.isActivityManager(id, activity.initiatorId, uid),
      this.activeCommunityId(uid),
    ]);

    // DRAFT 仅管理者可见；下架/圈外：管理者与已报名用户仍可访问（AC-027/029），其余拒绝
    const visibleScope = activity.scope === ActivityScope.PLATFORM || activity.communityId === activeCommunityId;
    if (activity.status === ActivityStatus.DRAFT && !isManager) {
      throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const hasEnrollmentAccess = !!enrollment
      && enrollment.status !== ActivityEnrollmentStatus.REJECTED;
    if (!visibleScope && !isManager && !hasEnrollmentAccess) {
      throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const isApproved = enrollment?.status === ActivityEnrollmentStatus.APPROVED;
    const sensitiveVisible = isApproved || isManager || activity.infoVisibility === ActivityInfoVisibility.PUBLIC;
    const now = new Date();
    const readonly = !!activity.chatReadonlyAt && now >= activity.chatReadonlyAt;
    const base = this.toListVo(
      activity,
      counts,
      null,
      enrollment?.status ?? (interest?.state === ActivityInterestState.INTERESTED ? 'INTERESTED' : null),
    );
    const community = activity.communityId
      ? await this.prisma.community.findUnique({ where: { id: activity.communityId }, select: { name: true } })
      : null;
    return {
      ...base,
      communityName: community?.name ?? null,
      description: activity.description,
      location: sensitiveVisible ? activity.location : null,
      joinLink: sensitiveVisible ? activity.joinLink : null,
      infoVisibility: activity.infoVisibility,
      locationVisible: sensitiveVisible && !!activity.location,
      joinLinkVisible: sensitiveVisible && !!activity.joinLink,
      enrollStartAt: activity.enrollStartAt?.toISOString() ?? null,
      form: this.readForm(activity),
      initiator: initiator ?? { id: activity.initiatorId, nickname: '用户', avatarUrl: null },
      adminIds: adminRows.map((a) => a.userId),
      canManage: isManager,
      isInitiator: activity.initiatorId === uid,
      myInterest: interest?.state ?? null,
      myEnrollment: enrollment
        ? {
          id: enrollment.id,
          status: enrollment.status,
          data: enrollment.data as ActivityFormData,
          pendingReview: !!enrollment.pendingData,
          revokedReason: enrollment.revokedReason,
          createdAt: enrollment.createdAt.toISOString(),
          updatedAt: enrollment.updatedAt.toISOString(),
        }
        : null,
      chat: {
        canChat: isApproved || isManager,
        readonly,
        readonlyAt: activity.chatReadonlyAt?.toISOString() ?? null,
      },
      larkSync: activity.larkConnectionId ? { enabled: true } : null,
    };
  }

  /** 我的活动（AC-011/022/027）：已退出圈子的报名活动仍可访问 */
  async mine(uid: string, tab: string): Promise<{ list: ActivityListVo[] }> {
    const endedStatuses = [ActivityStatus.ENDED, ActivityStatus.CANCELLED, ActivityStatus.DELISTED];
    let activities: Activity[];
    const decorate = async (list: Activity[]): Promise<ActivityListVo[]> => {
      const countList = await Promise.all(list.map((a) => this.counts(a.id)));
      const enrollments = list.length
        ? await this.prisma.activityEnrollment.findMany({
          where: { userId: uid, activityId: { in: list.map((a) => a.id) } },
          select: { activityId: true, status: true },
        })
        : [];
      const statusMap = new Map(enrollments.map((e) => [e.activityId, e.status]));
      const communityIds = [...new Set(list.map((a) => a.communityId).filter((c): c is string => !!c))];
      const communities = communityIds.length
        ? await this.prisma.community.findMany({ where: { id: { in: communityIds } }, select: { id: true, name: true } })
        : [];
      const nameMap = new Map(communities.map((c) => [c.id, c.name]));
      return list.map((a, i) => this.toListVo(a, countList[i] ?? { approved: 0, pending: 0, waitlist: 0 }, nameMap.get(a.communityId ?? '') ?? null, statusMap.get(a.id) ?? null));
    };

    if (tab === 'interested' || tab === 'not_interested') {
      const state = tab === 'interested' ? ActivityInterestState.INTERESTED : ActivityInterestState.NOT_INTERESTED;
      const interests = await this.prisma.activityInterest.findMany({
        where: { userId: uid, state },
        orderBy: { updatedAt: 'desc' },
        select: { activityId: true },
      });
      const ids = interests.map((i) => i.activityId);
      activities = ids.length
        ? (await this.prisma.activity.findMany({ where: { id: { in: ids } } })).filter((a) => a.status !== ActivityStatus.DRAFT)
        : [];
      // 兴趣列表按标记时间倒序
      const order = new Map(ids.map((id, i) => [id, i]));
      activities.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      const vos = await decorate(activities);
      const list = vos.map((vo) => ({ ...vo, myStatus: state === ActivityInterestState.INTERESTED ? 'INTERESTED' : 'NOT_INTERESTED' }));
      return { list };
    }

    const statusByTab: Record<string, ActivityEnrollmentStatus[]> = {
      enrolled: [ActivityEnrollmentStatus.APPROVED],
      pending: [ActivityEnrollmentStatus.PENDING_REVIEW, ActivityEnrollmentStatus.REJECTED],
      waitlist: [ActivityEnrollmentStatus.WAITLIST],
      cancelled: [ActivityEnrollmentStatus.CANCELLED, ActivityEnrollmentStatus.REVOKED],
    };
    if (tab === 'ended') {
      const enrollments = await this.prisma.activityEnrollment.findMany({
        where: { userId: uid, status: { in: [ActivityEnrollmentStatus.APPROVED, ActivityEnrollmentStatus.WAITLIST, ActivityEnrollmentStatus.PENDING_REVIEW, ActivityEnrollmentStatus.CANCELLED, ActivityEnrollmentStatus.REVOKED] } },
        orderBy: { updatedAt: 'desc' },
        select: { activityId: true },
      });
      const ids = [...new Set(enrollments.map((e) => e.activityId))];
      activities = ids.length
        ? (await this.prisma.activity.findMany({ where: { id: { in: ids }, status: { in: endedStatuses } } }))
        : [];
    } else {
      const statuses = statusByTab[tab];
      if (!statuses) throw new BizException(70020, '无效的活动分组');
      const enrollments = await this.prisma.activityEnrollment.findMany({
        where: { userId: uid, status: { in: statuses } },
        orderBy: { updatedAt: 'desc' },
        select: { activityId: true, status: true },
      });
      const ids = enrollments.map((e) => e.activityId);
      const idStatus = new Map(enrollments.map((e) => [e.activityId, e.status]));
      // 已报名/待审核/候补分组排除活动已终态的（归入「已结束」分组）
      activities = ids.length
        ? (await this.prisma.activity.findMany({ where: { id: { in: ids }, status: { notIn: [...endedStatuses, ActivityStatus.DRAFT] } } }))
        : [];
      const vos = await decorate(activities);
      return { list: vos.map((vo) => ({ ...vo, myStatus: idStatus.get(vo.id) ?? vo.myStatus })) };
    }
    return { list: await decorate(activities) };
  }

  /** 感兴趣 / 不感兴趣 / 恢复（AC-011/013） */
  async setInterest(uid: string, id: string, dto: SetInterestDto): Promise<void> {
    const activity = await this.getOrThrow(id);
    if (activity.status === ActivityStatus.DRAFT) throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    if (!dto.state) {
      await this.prisma.activityInterest.deleteMany({ where: { activityId: id, userId: uid } });
      return;
    }
    await this.prisma.activityInterest.upsert({
      where: { activityId_userId: { activityId: id, userId: uid } },
      update: { state: dto.state as ActivityInterestState },
      create: { activityId: id, userId: uid, state: dto.state as ActivityInterestState },
    });
  }

  // ===== 提醒（AC-015/016/AC-038） =====

  /** 手动提醒（发起人/活动管理员）：仅正式参与人、同人同活动 24h 一次 */
  async remind(uid: string, id: string, dto: RemindDto) {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    if (CLOSED_ACTIVITY_STATUSES.includes(activity.status)) {
      throw new BizException(...ERR.STATUS_INVALID('活动已结束，不能再发送提醒'));
    }
    const targets = await this.prisma.activityEnrollment.findMany({
      where: dto.targetUserIds?.length
        ? { activityId: id, status: ActivityEnrollmentStatus.APPROVED, userId: { in: dto.targetUserIds } }
        : { activityId: id, status: ActivityEnrollmentStatus.APPROVED },
      select: { userId: true },
    });
    const now = Date.now();
    const results: { userId: string; result: string }[] = [];
    for (const target of targets) {
      const last = await this.prisma.activityReminder.findFirst({
        where: { activityId: id, userId: target.userId, kind: ActivityReminderKind.MANUAL },
        orderBy: { createdAt: 'desc' },
      });
      if (last && now - last.createdAt.getTime() < 24 * 3600 * 1000) {
        results.push({ userId: target.userId, result: 'skipped_rate_limited' });
        continue;
      }
      const result = await this.sendReminder(activity, target.userId, ActivityReminderKind.MANUAL, uid);
      results.push({ userId: target.userId, result });
    }
    const skipped = results.filter((r) => r.result === 'skipped_rate_limited').length;
    if (skipped > 0 && skipped === results.length) {
      throw new BizException(...ERR.REMIND_RATE_LIMITED);
    }
    return { total: results.length, skipped, results };
  }

  /** 自动提醒（scheduler 调用，窗口判定在 scheduler）：T-3d / T-1d，dedupKey=kind 保证同一节点只发一次（AC-015/020） */
  async sendAutoReminders(activity: Activity, kind: ActivityReminderKind): Promise<number> {
    const approved = await this.prisma.activityEnrollment.findMany({
      where: { activityId: activity.id, status: ActivityEnrollmentStatus.APPROVED },
      select: { userId: true },
    });
    let sent = 0;
    for (const target of approved) {
      const result = await this.sendReminder(activity, target.userId, kind);
      if (result === 'sent' || result === 'skipped_no_template') sent += 1;
    }
    return sent;
  }

  /** 单条提醒落库（含去重）：站内通知必发，微信订阅消息尽力而为（AC-021） */
  private async sendReminder(
    activity: Activity,
    userId: string,
    kind: ActivityReminderKind,
    sentBy?: string,
  ): Promise<string> {
    const dedupKey = kind === ActivityReminderKind.MANUAL ? `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : kind;
    try {
      await this.prisma.activityReminder.create({
        data: { activityId: activity.id, userId, kind, dedupKey, sentBy: sentBy ?? null, result: 'sent' },
      });
    } catch {
      // 唯一冲突 = 该节点已发过（自动提醒去重）
      return 'skipped_already_sent';
    }
    const when = activity.startTime
      ? `将于 ${formatDateTime(activity.startTime)} 开始`
      : '正在进行中';
    const noTemplate = !this.wxHasActivityTemplate();
    await this.notification.create({
      userId,
      type: NotificationType.ACTIVITY_REMINDER,
      title: '活动提醒',
      content: `「${activity.title}」${when}，请准时参与`,
      targetType: 'activity',
      targetId: activity.id,
    });
    if (noTemplate) {
      await this.prisma.activityReminder.updateMany({
        where: { activityId: activity.id, userId, kind, dedupKey },
        data: { result: 'skipped_no_template' },
      });
      return 'skipped_no_template';
    }
    return 'sent';
  }

  private wxHasActivityTemplate(): boolean {
    return !!process.env.WX_SUBSCRIBE_ACTIVITY_REMIND_TEMPLATE_ID;
  }

  async listReminders(uid: string, id: string, page = 1, pageSize = 20) {
    const activity = await this.getOrThrow(id);
    await this.assertManager(activity, uid);
    const [total, list] = await Promise.all([
      this.prisma.activityReminder.count({ where: { activityId: id } }),
      this.prisma.activityReminder.findMany({
        where: { activityId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: list.map((r) => r.userId).concat(list.map((r) => r.sentBy ?? '').filter(Boolean)) } },
      select: { id: true, nickname: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.nickname]));
    return {
      list: list.map((r) => ({
        id: r.id,
        kind: r.kind,
        userId: r.userId,
        userNickname: nameMap.get(r.userId) ?? '已注销用户',
        sentBy: r.sentBy,
        sentByNickname: r.sentBy ? nameMap.get(r.sentBy) ?? '已注销用户' : null,
        result: r.result,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ===== 群聊（复用 ChatMessage.groupId，实名 uid） =====

  async sendChatMessage(uid: string, id: string, content: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    const isManager = await this.isActivityManager(id, activity.initiatorId, uid);
    const enrollment = await this.prisma.activityEnrollment.findUnique({
      where: { activityId_userId: { activityId: id, userId: uid } },
    });
    const isApproved = enrollment?.status === ActivityEnrollmentStatus.APPROVED;
    if (!isApproved && !isManager) throw new BizException(...ERR.NOT_APPROVED_MEMBER);
    if (activity.chatReadonlyAt && new Date() >= activity.chatReadonlyAt) {
      throw new BizException(...ERR.CHAT_READONLY);
    }
    const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { openid: true } });
    return this.chat.sendGroupMessage(uid, activityChatGroupId(id), content, 'text', user?.openid);
  }

  async listChatMessages(uid: string, id: string, cursor?: string) {
    const activity = await this.prisma.activity.findUnique({ where: { id } });
    if (!activity) throw new BizException(...ERR.NOT_FOUND, HttpStatus.NOT_FOUND);
    const isManager = await this.isActivityManager(id, activity.initiatorId, uid);
    const enrollment = await this.prisma.activityEnrollment.findUnique({
      where: { activityId_userId: { activityId: id, userId: uid } },
    });
    const isApproved = enrollment?.status === ActivityEnrollmentStatus.APPROVED;
    if (!isApproved && !isManager) throw new BizException(...ERR.NOT_APPROVED_MEMBER);
    const result = await this.chat.listGroupMessages(activityChatGroupId(id), cursor, 50);
    // 发送者昵称/头像补充
    const fromIds = [...new Set(result.list.map((m) => m.fromId).filter((f) => f !== 'system'))];
    const users = fromIds.length
      ? await this.prisma.user.findMany({
        where: { id: { in: fromIds } },
        select: { id: true, nickname: true, avatarUrl: true },
      })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      ...result,
      list: result.list.map((m) => ({
        ...m,
        nickname: userMap.get(m.fromId)?.nickname ?? (m.fromId === 'system' ? '系统' : '已注销用户'),
        avatarUrl: userMap.get(m.fromId)?.avatarUrl ?? null,
      })),
    };
  }

  // ===== 通知辅助 =====

  private async notifyOne(userId: string, type: string, title: string, content: string, activityId: string): Promise<void> {
    await this.notification.create({ userId, type, title, content, targetType: 'activity', targetId: activityId });
  }

  private async notifyManagers(activityId: string, activity: Activity, title: string, content: string): Promise<void> {
    const admins = await this.prisma.activityAdmin.findMany({ where: { activityId }, select: { userId: true } });
    const targets = [activity.initiatorId, ...admins.map((a) => a.userId)];
    for (const target of targets) {
      await this.notifyOne(target, NotificationType.ACTIVITY_PENDING_REVIEW, title, content, activityId);
    }
  }

  private async notifyParticipants(
    activityId: string,
    activity: Activity,
    type: string,
    title: string,
    content: string,
    statuses: ActivityEnrollmentStatus[] = [ActivityEnrollmentStatus.APPROVED],
  ): Promise<void> {
    const enrollments = await this.prisma.activityEnrollment.findMany({
      where: { activityId, status: { in: statuses } },
      select: { userId: true },
    });
    for (const e of enrollments) {
      await this.notifyOne(e.userId, type, title, content, activityId);
    }
  }

  // ===== 飞书连接 =====

  async listConnections(uid: string) {
    return this.larkSync.listConnections(uid);
  }

  async createConnection(uid: string, dto: CreateLarkConnectionDto) {
    return this.larkSync.createConnection(uid, dto);
  }

  async deleteConnection(uid: string, id: string) {
    const inUse = await this.prisma.activity.count({ where: { larkConnectionId: id } }) > 0;
    if (inUse) throw new BizException(...ERR.CONNECTION_IN_USE);
    return this.larkSync.deleteConnection(uid, id);
  }

  async listSyncRecords(uid: string, activityId: string) {
    const activity = await this.getOrThrow(activityId);
    await this.assertManager(activity, uid);
    return this.larkSync.listRecords(activityId);
  }

  async retrySync(uid: string, activityId: string) {
    const activity = await this.getOrThrow(activityId);
    await this.assertManager(activity, uid);
    return this.larkSync.retryAll(activityId);
  }
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
