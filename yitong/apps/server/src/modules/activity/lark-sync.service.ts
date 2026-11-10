import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ActivitySyncStatus, type Activity, type ActivityEnrollment, type LarkConnection } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActivityFormData, ActivityFormField } from './types';
import type { CreateLarkConnectionDto } from './dto';

// 飞书多维表格单向同步（specs/features/活动模块.md §4.8）
// - 连接 = 发起人自建飞书应用（app_id/app_secret），密钥仅服务端与库内保存、接口脱敏
// - 稳定标识 = enrollmentId；首次成功后记 remoteRecordId，重试走更新不重复建行（AC-030）
// - 同步失败只记状态与原因，绝不阻塞小程序内报名（BR-013）
// 目标表格字段约定（发起人自建多维表格需包含这些列）：
//   报名编号(文本) / 用户(文本) / 状态(文本) / 报名资料(文本) / 更新时间(文本)
const LARK_BASE = 'https://open.feishu.cn';
const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;

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

  /** 标记某条报名待同步（报名新增/修改/取消/取消资格时调用） */
  async markPending(activityId: string, enrollmentId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { larkConnectionId: true },
    });
    if (!activity?.larkConnectionId) return; // 未配置同步的活动直接跳过
    await this.prisma.activitySyncRecord.upsert({
      where: { activityId_enrollmentId: { activityId, enrollmentId } },
      update: { status: ActivitySyncStatus.PENDING, lastError: null },
      create: { activityId, enrollmentId, status: ActivitySyncStatus.PENDING },
    });
    void this.pushPending(activityId).catch((e: unknown) => {
      this.logger.warn(`lark push failed for activity ${activityId}: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  /** 活动取消：全部报名记录重新同步（状态列更新） */
  async markAllPending(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      select: { larkConnectionId: true },
    });
    if (!activity?.larkConnectionId) return;
    await this.prisma.activitySyncRecord.updateMany({
      where: { activityId },
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

  private fieldsPayload(activity: Activity, enrollment: ActivityEnrollment, nickname: string): Record<string, { text: string }> {
    const form = activity.form as unknown as ActivityFormField[];
    const data = enrollment.data as ActivityFormData;
    const summary = form
      .filter((f) => data[f.key] !== undefined && data[f.key] !== null)
      .map((f) => `${f.label}: ${Array.isArray(data[f.key]) ? (data[f.key] as string[]).join('、') : String(data[f.key])}`)
      .join('\n');
    return {
      报名编号: { text: enrollment.id },
      用户: { text: nickname },
      状态: { text: enrollment.status },
      报名资料: { text: summary || '（空）' },
      更新时间: { text: new Date().toISOString() },
    };
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
      try {
        const fields = this.fieldsPayload(activity, enrollment, nickname);
        let recordId = record.remoteRecordId ?? undefined;
        if (recordId) {
          // 已有远端记录 → 更新（重试不产生重复行）
          const res = await fetch(
            `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/records/${recordId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ fields }),
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
              body: JSON.stringify({ fields }),
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
