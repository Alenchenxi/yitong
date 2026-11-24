import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ActivitySyncOp, ActivitySyncStatus, type Activity, type ActivityEnrollment, type LarkConnection } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActivityFormData, ActivityFormField } from './types';
import type { CreateLarkConnectionDto, UpdateLarkConnectionDto } from './dto';

// 飞书多维表格单向同步（specs/features/活动模块.md §4.8 + 逐列扩展）
// - 连接 = 发起人自建飞书应用（app_id/app_secret），密钥仅服务端与库内保存、接口脱敏
// - 逐列写入：固定列（报名编号/用户/状态/报名时间/更新时间）+ 报名表单字段逐列（列名=字段名，文本类型，缺失自动创建）
// - 行定位：优先 remoteRecordId；缺失时按「报名编号」列精确搜索远端行（更新/删除都用它定位，报名编号天然不变）；
//   全部未命中时复用「报名编号」为空的默认空行写入，仍无才追加建行
// - 主键列：新表默认主键「文本」首次同步时自动改名为「报名编号」并复用，消除空置主键列（旧表已有编号列则不动）
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

// 同步写值一律为纯字符串（{text} 单对象形态飞书会拒 1254060 TextFieldConvFail，须为字符串或富文本数组）；
// 只列常见类型，其余回退显示类型号
const FIELD_TYPE_NAME: Record<number, string> = {
  2: '数字', 3: '单选', 4: '多选', 5: '日期', 6: '复选框', 7: '人员', 8: '电话', 9: '超链接', 10: '附件',
};

interface TenantTokenResp {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
}

interface WikiNodeResp {
  code?: number;
  msg?: string;
  data?: { node?: { obj_token?: string; obj_type?: string } };
}

interface BitableAppMetaResp {
  code?: number;
  msg?: string;
  data?: { name?: string; url?: string };
}

interface BitableTablesResp {
  code?: number;
  msg?: string;
  data?: { items?: Array<{ table_id?: string; name?: string }> };
}

interface BitableRecordResp {
  code?: number;
  msg?: string;
  data?: { record?: { record_id?: string } };
}

interface BitableFieldsResp {
  code?: number;
  msg?: string;
  data?: { items?: Array<{ field_id?: string; field_name?: string; type?: number; is_primary?: boolean }> };
}

interface BitableSearchResp {
  code?: number;
  msg?: string;
  data?: { items?: Array<{ record_id?: string }> };
}

interface BitableRecordsListResp {
  code?: number;
  msg?: string;
  data?: { items?: Array<{ record_id?: string; fields?: Record<string, unknown> }> };
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

  async updateConnection(uid: string, id: string, dto: UpdateLarkConnectionDto) {
    const conn = await this.prisma.larkConnection.findUnique({ where: { id } });
    if (!conn || conn.ownerId !== uid) {
      throw new BizException(70012, '飞书连接不存在', HttpStatus.NOT_FOUND);
    }
    await this.prisma.larkConnection.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        appId: dto.appId.trim(),
        // secret 不回显，编辑留空 = 不修改
        ...(dto.appSecret?.trim() ? { appSecret: dto.appSecret.trim() } : {}),
      },
    });
    this.tokenCache.delete(id);
    return { updated: true };
  }

  async deleteConnection(uid: string, id: string) {
    const conn = await this.prisma.larkConnection.findUnique({ where: { id } });
    if (!conn || conn.ownerId !== uid) {
      throw new BizException(70012, '飞书连接不存在', HttpStatus.NOT_FOUND);
    }
    await this.prisma.larkConnection.delete({ where: { id } });
    return { deleted: true };
  }

  // ===== 连接配置校验（创建/保存活动前强校验，2026-11-18 用户需求） =====

  private async larkGet(token: string, path: string): Promise<{ code?: number; msg?: string }> {
    const res = await fetch(`${LARK_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as { code?: number; msg?: string };
  }

  /** 飞书网络层异常：落日志并把真实原因带进用户可见消息（此前 catch{} 吞掉真实错误，线上无法定位根因） */
  private networkFail(e: unknown, friendly: string): BizException {
    const parts = e instanceof Error ? [e.name, e.message, e.cause instanceof Error ? e.cause.message : ''] : [String(e)];
    const cause = parts.filter(Boolean).join(': ').slice(0, 160);
    this.logger.warn(`飞书 API 网络异常: ${cause}`);
    return new BizException(70013, `${friendly}（原因：${cause}）`, HttpStatus.BAD_GATEWAY);
  }

  /** 飞书业务失败统一组装：91403（无编辑权限）/1254060（列类型非文本）附自助修复提示，进同步记录 lastError */
  private larkBizError(prefix: string, code?: number, msg?: string): Error {
    let hint = '';
    if (code === 91403) hint = '（91403 Forbidden：请把本应用在该多维表格的协作者权限改为「可编辑」，并确认应用已开通多维表格 API 权限）';
    if (code === 1254060) hint = '（1254060 TextFieldConvFail：表格中存在与同步列同名的非文本类型列，请改为多行文本或删除后重试）';
    return new Error(`${prefix}: ${code} ${msg ?? ''}${hint}`);
  }

  /** 校验连接凭证与目标多维表格可达性；任一环节失败抛 BizException 细分原因，由前端阻断提交 */
  async verifyConfig(
    uid: string,
    dto: { connectionId: string; bitableApp: string; bitableTable: string },
  ): Promise<{ ok: true }> {
    const conn = await this.prisma.larkConnection.findUnique({ where: { id: dto.connectionId } });
    if (!conn || conn.ownerId !== uid) {
      throw new BizException(70012, '飞书连接不存在或已被删除，请重新选择连接', HttpStatus.NOT_FOUND);
    }
    const token = await this.tenantToken(conn);
    const appPath = `/open-apis/bitable/v1/apps/${encodeURIComponent(dto.bitableApp)}`;
    let app: { code?: number; msg?: string };
    try {
      app = await this.larkGet(token, appPath);
    } catch (e) {
      throw this.networkFail(e, '飞书服务暂不可达，请稍后重试');
    }
    if (app.code !== 0) {
      throw new BizException(
        70013,
        '多维表格 app_token 无法访问：请检查 URL /base/ 后段是否正确，并确认已把该飞书应用添加为表格协作者',
        HttpStatus.BAD_REQUEST,
      );
    }
    // 飞书无 GET /tables/{table_id} 路由（纯文本 404 会让 res.json() 抛 SyntaxError），列数据表后按 table_id 判存在
    let tablesResp: BitableTablesResp;
    try {
      tablesResp = (await this.larkGet(token, `${appPath}/tables?page_size=100`)) as BitableTablesResp;
    } catch (e) {
      throw this.networkFail(e, '飞书服务暂不可达，请稍后重试');
    }
    if (tablesResp.code !== 0) {
      throw new BizException(
        70013,
        '多维表格无法访问：请确认已把该飞书应用添加为表格协作者，或改用表格的 /base/ 分享链接',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!(tablesResp.data?.items ?? []).some((t) => t.table_id === dto.bitableTable)) {
      throw new BizException(70013, '数据表 table_id 不存在：请检查表格 URL 中 table= 参数', HttpStatus.BAD_REQUEST);
    }
    return { ok: true };
  }

  // ===== 多维表格链接解析（用户粘贴链接自动识别 app_token 与数据表，2026-11-19 用户需求） =====

  /** 从 /base/ 或 /wiki/ 链接提取表格标识；无法识别返回 undefined */
  private extractAppTokenFromUrl(url: string): { appToken?: string; wikiNode?: string; tableId?: string } {
    const base = url.match(/\/base\/([A-Za-z0-9]+)/);
    const wiki = url.match(/\/wiki\/([A-Za-z0-9]+)/);
    const table = url.match(/[?&]table=([A-Za-z0-9]+)/);
    return { appToken: base?.[1], wikiNode: wiki?.[1], tableId: table?.[1] };
  }

  /**
   * 解析用户粘贴的多维表格链接：提取 app_token（/wiki/ 链接经飞书 get_node 换取 obj_token），
   * 列出该表格全部数据表供用户按名称选择——用户全程不接触 token 概念。
   */
  async resolveBitable(
    uid: string,
    dto: { connectionId: string; url: string },
  ): Promise<{ appToken: string; tableId: string | null; baseName: string; tables: Array<{ tableId: string; name: string }> }> {
    const conn = await this.prisma.larkConnection.findUnique({ where: { id: dto.connectionId } });
    if (!conn || conn.ownerId !== uid) {
      throw new BizException(70012, '飞书连接不存在或已被删除，请重新选择连接', HttpStatus.NOT_FOUND);
    }
    const picked = this.extractAppTokenFromUrl(dto.url);
    if (!picked.appToken && !picked.wikiNode) {
      throw new BizException(70013, '无法从链接识别多维表格：请粘贴表格的分享链接（/base/ 或知识库 /wiki/ 链接）', HttpStatus.BAD_REQUEST);
    }
    const token = await this.tenantToken(conn);
    let appToken = picked.appToken ?? '';
    if (!appToken && picked.wikiNode) {
      let node: WikiNodeResp;
      try {
        node = (await this.larkGet(token, `/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(picked.wikiNode)}`)) as WikiNodeResp;
      } catch (e) {
        throw this.networkFail(e, '飞书服务暂不可达，请稍后重试');
      }
      if (node.code !== 0 || node.data?.node?.obj_type !== 'bitable' || !node.data.node.obj_token) {
        throw new BizException(
          70013,
          '知识库链接解析失败：请确认已把该飞书应用添加为表格协作者（知识库或表格级均可），或改用表格的 /base/ 分享链接',
          HttpStatus.BAD_REQUEST,
        );
      }
      appToken = node.data.node.obj_token;
    }
    // 多维表格名（回显用，让用户确认指向的是哪个表）：拉不到不阻断选表
    let baseName = '';
    try {
      const meta = (await this.larkGet(token, `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}`)) as BitableAppMetaResp;
      if (meta.code === 0 && meta.data?.name) baseName = meta.data.name;
    } catch {
      /* 忽略：仅影响回显 */
    }
    let tablesResp: BitableTablesResp;
    try {
      tablesResp = (await this.larkGet(token, `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables?page_size=100`)) as BitableTablesResp;
    } catch (e) {
      throw this.networkFail(e, '飞书服务暂不可达，请稍后重试');
    }
    if (tablesResp.code !== 0) {
      throw new BizException(
        70013,
        '多维表格无法访问：请确认已把该飞书应用添加为表格协作者，或改用表格的 /base/ 分享链接',
        HttpStatus.BAD_REQUEST,
      );
    }
    const tables = (tablesResp.data?.items ?? [])
      .filter((t): t is { table_id: string; name: string } => !!t.table_id)
      .map((t) => ({ tableId: t.table_id, name: t.name || t.table_id }));
    if (!tables.length) {
      throw new BizException(70013, '该多维表格下没有数据表，请先在表格中创建数据表', HttpStatus.BAD_REQUEST);
    }
    const tableId = picked.tableId && tables.some((t) => t.tableId === picked.tableId) ? picked.tableId : null;
    return { appToken, tableId, baseName, tables };
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
    let data: TenantTokenResp;
    try {
      const res = await fetch(`${LARK_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: conn.appId, app_secret: conn.appSecret }),
        signal: AbortSignal.timeout(10_000),
      });
      data = (await res.json()) as TenantTokenResp;
    } catch (e) {
      // 网络层失败与凭证被拒分开报：网络不通不再误报成 app_id/app_secret 不正确
      throw this.networkFail(e, '连接飞书失败：服务不可达或网络超时');
    }
    if (data.code !== 0 || !data.tenant_access_token) {
      throw new BizException(70013, '连接的 app_id 或 app_secret 不正确（换取飞书应用凭证失败）', HttpStatus.BAD_REQUEST);
    }
    this.tokenCache.set(conn.id, {
      token: data.tenant_access_token,
      expiresAt: Date.now() + Math.min((data.expire ?? 7200) * 1000, TOKEN_CACHE_TTL_MS),
    });
    return data.tenant_access_token;
  }

  /** 逐列组装：固定列 + 报名表单字段列（列名=字段 label；值一律纯字符串，{text} 单对象形态飞书拒 1254060） */
  private buildColumns(activity: Activity, enrollment: ActivityEnrollment, nickname: string): Record<string, string> {
    const form = activity.form as unknown as ActivityFormField[];
    const data = enrollment.data as ActivityFormData;
    const columns: Record<string, string> = {
      报名编号: enrollment.id,
      用户: nickname,
      状态: STATUS_TEXT[enrollment.status] ?? enrollment.status,
      报名时间: formatDateTime(enrollment.createdAt),
      更新时间: formatDateTime(new Date()),
    };
    for (const f of form) {
      const v = data[f.key];
      if (v === undefined || v === null) continue;
      const text = Array.isArray(v) ? v.join('、') : String(v);
      if (!text) continue;
      // 防御：字段名与保留列撞名时跳过该字段列，避免覆盖固定列的值（发布页已拦截新活动命名）
      if ((FIXED_COLUMNS as readonly string[]).includes(f.label || f.key)) continue;
      columns[f.label || f.key] = text;
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
      throw this.larkBizError('搜索报名编号失败', data.code, data.msg);
    }
    return data.data.items?.[0]?.record_id;
  }

  /** 找一条「报名编号」为空的空行（新表默认空行），供直接写入复用；找不到返回 undefined */
  private async findEmptyRow(token: string, activity: Activity): Promise<string | undefined> {
    // 用 list 而非 search：search 的 isEmpty 需带 value 且对全空行不可靠，list 对空行返回 fields:{}，判断有无「报名编号」键即可
    const res = await fetch(
      `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/records?page_size=500`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) },
    );
    const data = (await res.json()) as BitableRecordsListResp;
    if (data.code !== 0 || !data.data) return undefined; // 空行复用是优化不是硬依赖：失败就走追加建行
    return (data.data.items ?? []).find((i) => i.record_id && !i.fields?.['报名编号'])?.record_id;
  }

  /** 确保目标表字段齐全（固定列 + 表单字段列；缺失自动创建为多行文本；已有但类型非文本则提前报错指明列名） */
  private async ensureColumns(token: string, activity: Activity, names: string[]): Promise<void> {
    const need = [...new Set([...FIXED_COLUMNS, ...names])];
    const res = await fetch(
      `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/fields?page_size=200`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    );
    const data = (await res.json()) as BitableFieldsResp;
    if (data.code !== 0 || !data.data) {
      throw this.larkBizError('读取表格字段失败', data.code, data.msg);
    }
    // 同步一律写纯字符串：已有列类型非文本会在建行时报 1254060，这里提前拦截并指出具体列
    const items = data.data.items ?? [];
    const existing = new Map<string, number>(items.map((i) => [i.field_name ?? '', i.type ?? 1]));
    // 主键列复用：新表默认主键「文本」不可删除且同步不写值会一直空着——改名为「报名编号」直接当编号列用；
    // 表中已有「报名编号」列（旧表）或主键非文本类型时不动，维持现状
    if (need.includes('报名编号') && !existing.has('报名编号')) {
      const primary = items.find((i) => i.is_primary && i.field_id && i.field_name && i.type === 1);
      if (primary) {
        const renamed = await fetch(
          `${LARK_BASE}/open-apis/bitable/v1/apps/${activity.larkBitableApp}/tables/${activity.larkBitableTable}/fields/${primary.field_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ field_name: '报名编号', type: 1 }),
            signal: AbortSignal.timeout(10_000),
          },
        );
        const rd = (await renamed.json()) as BitableFieldsResp;
        if (rd.code === 0) {
          existing.set('报名编号', 1);
        }
        // 改名失败（并发/权限等）静默跳过：走原有「缺失自动创建」路径，不影响同步
      }
    }
    for (const name of need) {
      const type = existing.get(name);
      if (type === 1) continue;
      if (type !== undefined) {
        throw new Error(
          `列「${name}」在表格中是${FIELD_TYPE_NAME[type] ?? `类型 ${type}`}，同步需要多行文本列：请把该列改为多行文本，或删除该列后重试（将自动重建）`,
        );
      }
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
      if (cd.code !== 0) throw this.larkBizError(`创建表格字段「${name}」失败`, cd.code, cd.msg);
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
            if (data.code !== 0) throw this.larkBizError('删除记录失败', data.code, data.msg);
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

      // 建行/更新行：优先 remoteRecordId → 按报名编号搜索定位 → 复用报名编号为空的默认空行 → 追加建行
      try {
        const columns = this.buildColumns(activity, enrollment, nickname);
        await this.ensureColumns(token, activity, Object.keys(columns).filter((n) => !FIXED_COLUMNS.includes(n as (typeof FIXED_COLUMNS)[number])));
        let recordId =
          record.remoteRecordId ?? (await this.findByEnrollmentNo(token, activity, enrollment.id)) ?? (await this.findEmptyRow(token, activity));
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
          if (data.code !== 0) throw this.larkBizError('更新记录失败', data.code, data.msg);
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
            throw this.larkBizError('创建记录失败', data.code, data.msg);
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
