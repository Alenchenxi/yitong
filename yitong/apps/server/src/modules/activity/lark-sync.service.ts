import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ActivitySyncOp, ActivitySyncStatus, type Activity, type ActivityEnrollment, type LarkConnection } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActivityFormData, ActivityFormField } from './types';
import type { CreateLarkConnectionDto } from './dto';

// 飞书多维表格单向同步（specs/features/活动模块.md §4.8 + 逐列扩展）
// - 连接 = 发起人自建飞书应用（app_id/app_secret），密钥仅服务端与库内保存、接口脱敏
// - 逐列写入：固定列（报名编号/用户/状态/报名时间/更新时间）+ 报名表单字段逐列（列名=字段名，文本类型，缺失自动创建）
// - 行定位：优先 remoteRecordId；缺失时按「报名编号」列精确搜索远端行（更新/删除都用它定位，报名编号天然不变）
// - 取消报名/取消资格 → op=REMOVE 删除远端行并清除同步记录
// - 同步失败只记状态与原因，绝不阻塞小程序内报名（BR-013）
const LARK_BASE = 'https://open.feishu.cn';
const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;

const FIXED_COLUMNS = ['报名编号', '用户', '状态', '报名时间', '更新时间'] as const;

const STATUS_TEXT: Record<string, string> = {
  PENDING_REVIEW: '待审核',
  APPROVED: '报名成功',
  WAITLIST: '候补中',
  CANCELLED: '已取消',
  REJECTED: '未通过',
  REVOKED: '资格已取消',
};

interface TenantTokenResp {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
}

interface BitableRecordResp {
  code?: number;
  msg?: string;
  data?: { record?: { record_id?: string } };
}

interface BitableFieldsResp {
  code?: number;
  msg?: string;
  data?: { items?: Array<{ field_name?: string }> };
}

interface BitableSearchResp {
  code?: number;
  msg?: string;
  data?: { items?: Array<{ record_id?: string }> };
}

@Injectable()
export class LarkSyncService {
  private readonly logger = new Logger(LarkSyncService.name);
  // connectionId -> { token, expiresAt }
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  // ===== 连接管理（仅发起人可管理活动所用连接，AC-039） =====

  async listConnections(uid: string) {
    const conns = await this.prisma.larkConnection.findMany({
      where: { ownerId: uid },
      orderBy: { createdAt: 'desc' },
    });
    // 密钥脱敏：任何页面不展示完整密钥
    return conns.map((c) => ({
      id: c.id,
      name: c.name,
      appId: c.appId,
      appSecretMasked: `${c.appSecret.slice(0, 3)}****${c.appSecret.slice(-2)}`,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async createConnection(uid: string, dto: CreateLarkConnectionDto) {
    const conn = await this.prisma.larkConnection.create({
      data: { name: dto.name.trim(), appId: dto.appId.trim(), appSecret: dto.appSecret.trim(), ownerId: uid },
    });
    return { id: conn.id };
  }

  async deleteConnection(uid: string, id: string) {
    const conn = await this.prisma.larkConnection.findUnique({ where: { id } });
    if (!conn || conn.ownerId !== uid) {
      throw new BizException(70012, '飞书连接不存在', HttpStatus.NOT_FOUND);
    }
    await this.prisma.larkConnection.delete({ where: { id } });
    return { deleted: true };
  }

  // ===== 同步记录 =====

  /** 标记某条报名待同步（op：upsert=创建/更新行；remove=取消报名/取消资格删行） */
  async markPending(activityId: string, enrollmentId: string, op: 'UPSERT' | 'REMOVE' = 'UPSERT'): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { larkConnectionId: true },
    });
    if (!activity?.larkConnectionId) return; // 未配置同步的活动直接跳过
    await this.prisma.activitySyncRecord.upsert({
      where: { activityId_enrollmentId: { activityId, enrollmentId } },
      update: { status: ActivitySyncStatus.PENDING, op, lastError: null },
      create: { activityId, enrollmentId, status: ActivitySyncStatus.PENDING, op },
    });
    void this.pushPending(activityId).catch((e: unknown) => {
      this.logger.warn(`lark push failed for activity ${activityId}: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  /** 活动取消：全部报名记录重新同步（状态列更新，不删行，保留外部留痕） */
  async markAllPending(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { larkConnectionId: true },
    });
    if (!activity?.larkConnectionId) return;
    await this.prisma.activitySyncRecord.updateMany({
      where: { activityId, op: ActivitySyncOp.UPSERT },
      data: { status: ActivitySyncStatus.PENDING },
    });
    void this.pushPending(activityId).catch((e: unknown) => {
      this.logger.warn(`lark push failed for activity ${activityId}: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  async listRecords(activityId: string) {
    const records = await this.prisma.activitySyncRecord.findMany({
      where: { activityId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const enrollments = await this.prisma.activityEnrollment.findMany({
      where: { id: { in: records.map((r) => r.enrollmentId) } },
      select: { id: true, userId: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: enrollments.map((e) => e.userId) } },
      select: { id: true, nickname: true },
    });
    const enrollmentUser = new Map(enrollments.map((e) => [e.id, users.find((u) => u.id === e.userId)?.nickname ?? '已注销用户']));
    return records.map((r) => ({
      id: r.id,
      enrollmentId: r.enrollmentId,
      userNickname: enrollmentUser.get(r.enrollmentId) ?? '已注销用户',
      op: r.op,
      status: r.status,
      attempts: r.attempts,
      lastError: r.lastError,
      syncedAt: r.syncedAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /** 手动重试全部失败记录（管理者入口，AC-030） */
  async retryAll(activityId: string): Promise<{ retried: number }> {
    const updated = await this.prisma.activitySyncRecord.updateMany({
      where: { activityId, status: ActivitySyncStatus.FAILED },
      data: { status: ActivitySyncStatus.PENDING, lastError: null },
    });
    if (updated.count > 0) {
      await this.pushPending(activityId);
    }
    return { retried: updated.count };
  }

  // ===== 推送 =====

  private async tenantToken(conn: LarkConnection): Promise<string> {
    const cached = this.tokenCache.get(conn.id);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await fetch(`${LARK_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: conn.appId, app_secret: conn.appSecret }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as TenantTokenResp;
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`获取飞书凭证失败: ${data.code} ${data.msg ?? ''}`);
    }
    this.tokenCache.set(conn.id, {
      token: data.tenant_access_token,
      expiresAt: Date.now() + Math.min((data.expire ?? 7200) * 1000, TOKEN_CACHE_TTL_MS),
    });
    return data.tenant_access_token;
  }

  /** 逐列组装：固定列 + 报名表单字段列（列名=字段 label） */
  private buildColumns(activity: Activity, enrollment: ActivityEnrollment, nickname: string): Record<string, { text: string }> {
    const form = activity.form as unknown as ActivityFormField[];
    const data = enrollment.data as ActivityFormData;
    const columns: Record<string, { text: string }> = {
      报名编号: { text: enrollment.id },
      用户: { text: nickname },
      状态: { text: STATUS_TEXT[enrollment.status] ?? enrollment.status },
      报名时间: { text: formatDateTime(enrollment.createdAt) },
      更新时间: { text: formatDateTime(new Date()) },
    };
    for (const f of form) {
      const v = data[f.key];
      if (v === undefined || v === null) continue;
      const text = Array.isArray(v) ? v.join('、') : String(v);
      if (!text) continue;
      // 防御：字段名与保留列撞名时跳过该字段列，避免覆盖固定列的值（发布页已拦截新活动命名）
      if ((FIXED_COLUMNS as readonly string[]).includes(f.label || f.key)) continue;
      columns[f.label || f.key] = { text };
    }
    return columns;
  }

  /** 按「报名编号」列精确搜索远端行 record_id（找不到返回 undefined） */
  private async findByEnrollmentNo(token: string, activity: Activity, enrollmentNo: string): Promise<string | undefined> {
    const res = await fetch(
      `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/records/search?page_size=20`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          filter: { conjunction: 'and', conditions: [{ field_name: '报名编号', operator: 'is', value: [enrollmentNo] }] },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = (await res.json()) as BitableSearchResp;
    if (data.code !== 0 || !data.data) {
      throw new Error(`搜索报名编号失败: ${data.code} ${data.msg ?? ''}`);
    }
    return data.data.items?.[0]?.record_id;
  }

  /** 确保目标表字段齐全（固定列 + 表单字段列；缺失自动创建为多行文本） */
  private async ensureColumns(token: string, activity: Activity, names: string[]): Promise<void> {
    const need = [...new Set([...FIXED_COLUMNS, ...names])];
    const res = await fetch(
      `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/fields?page_size=200`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    const data = (await res.json()) as BitableFieldsResp;
    if (data.code !== 0 || !data.data) {
      throw new Error(`读取表格字段失败: ${data.code} ${data.msg ?? ''}`);
    }
    const existing = new Set((data.data.items ?? []).map((i) => i.field_name ?? ''));
    for (const name of need) {
      if (existing.has(name)) continue;
      const created = await fetch(
        `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/fields`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ field_name: name, type: 1 }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const cd = (await created.json()) as BitableFieldsResp;
      if (cd.code !== 0) throw new Error(`创建表格字段「${name}」失败: ${cd.code} ${cd.msg ?? ''}`);
    }
  }

  /** 推送全部 PENDING 记录（fire-and-forget 场景由调用方 catch） */
  async pushPending(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity?.larkConnectionId) return;
    const conn = await this.prisma.larkConnection.findUnique({ where: { id: activity.larkConnectionId } });
    if (!conn) return;
    const pending = await this.prisma.activitySyncRecord.findMany({
      where: { activityId, status: { in: [ActivitySyncStatus.PENDING] } },
      take: 50,
    });
    if (pending.length === 0) return;
    let token: string;
    try {
      token = await this.tenantToken(conn);
    } catch (e) {
      await this.failRecords(pending.map((r) => r.id), e instanceof Error ? e.message : String(e));
      return;
    }
    const enrollmentIds = pending.map((r) => r.enrollmentId);
    const enrollments = await this.prisma.activityEnrollment.findMany({ where: { id: { in: enrollmentIds } } });
    const users = await this.prisma.user.findMany({
      where: { id: { in: enrollments.map((e) => e.userId) } },
      select: { id: true, nickname: true },
    });
    for (const record of pending) {
      const enrollment = enrollments.find((e) => e.id === record.enrollmentId);
      if (!enrollment) {
        await this.failRecords([record.id], '报名记录不存在');
        continue;
      }
      const nickname = users.find((u) => u.id === enrollment.userId)?.nickname ?? '已注销用户';

      // 删行（取消报名/取消资格）：remoteRecordId 缺失时按报名编号搜索定位；成功后清除同步记录
      if (record.op === ActivitySyncOp.REMOVE) {
        try {
          const recordId = record.remoteRecordId ?? await this.findByEnrollmentNo(token, activity, enrollment.id);
          if (recordId) {
            const res = await fetch(
              `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/records/${recordId}`,
              { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) },
            );
            const data = (await res.json()) as BitableRecordResp;
            if (data.code !== 0) throw new Error(`删除记录失败: ${data.code} ${data.msg ?? ''}`);
          }
          await this.prisma.activitySyncRecord.delete({ where: { id: record.id } });
        } catch (e) {
          const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
          await this.prisma.activitySyncRecord.update({
            where: { id: record.id },
            data: { status: ActivitySyncStatus.FAILED, attempts: { increment: 1 }, lastError: message },
          });
        }
        continue;
      }

      // 建行/更新行：优先 remoteRecordId，缺失时按报名编号搜索定位
      try {
        const columns = this.buildColumns(activity, enrollment, nickname);
        await this.ensureColumns(token, activity, Object.keys(columns).filter((n) => !FIXED_COLUMNS.includes(n as (typeof FIXED_COLUMNS)[number])));
        let recordId = record.remoteRecordId ?? await this.findByEnrollmentNo(token, activity, enrollment.id);
        if (recordId) {
          const res = await fetch(
            `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/records/${recordId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ fields: columns }),
              signal: AbortSignal.timeout(15_000),
            },
          );
          const data = (await res.json()) as BitableRecordResp;
          if (data.code !== 0) throw new Error(`更新记录失败: ${data.code} ${data.msg ?? ''}`);
        } else {
          const res = await fetch(
            `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/records`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ fields: columns }),
              signal: AbortSignal.timeout(15_000),
            },
          );
          const data = (await res.json()) as BitableRecordResp;
          if (data.code !== 0 || !data.data?.record?.record_id) {
            throw new Error(`创建记录失败: ${data.code} ${data.msg ?? ''}`);
          }
          recordId = data.data.record.record_id;
        }
        await this.prisma.activitySyncRecord.update({
          where: { id: record.id },
          data: { status: ActivitySyncStatus.SYNCED, remoteRecordId: recordId, syncedAt: new Date(), attempts: { increment: 1 }, lastError: null },
        });
      } catch (e) {
        const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        await this.prisma.activitySyncRecord.update({
          where: { id: record.id },
          data: { status: ActivitySyncStatus.FAILED, attempts: { increment: 1 }, lastError: message },
        });
      }
    }
  }

  private async failRecords(ids: string[], message: string): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.activitySyncRecord.updateMany({
      where: { id: { in: ids } },
      data: { status: ActivitySyncStatus.FAILED, lastError: message.slice(0, 500) },
    });
  }
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
