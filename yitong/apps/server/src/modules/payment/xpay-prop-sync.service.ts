import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  JobDuration,
  type BoostPlan,
  type PricingConfig,
} from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { WxXPayService } from '../../common/wx/wx-xpay.service';
import { PrismaService } from '../../prisma/prisma.service';

// 错误码 50008（支付段 5xxxx）：改价后新道具尚未在微信支付网关生效（对用户提示「当前支付人数过多」）
export const XPAY_PRICE_SWITCHING_CODE = 50008;

// 道具 ID 编码价格（价格变更 => 新 ID），长度须 ≤20 且仅字母/数字/_/-（官方限制）。
// 例：D30 90 元 -> jp_d30_p9000（分）
export function xpayPropIdFor(duration: JobDuration, priceFen: number): string {
  const d = duration === JobDuration.D90 ? 'd90' : 'd30';
  return `jp_${d}_p${priceFen}`;
}

// 推广档位道具 ID：BOOST_1D@5元 -> bt_1d_p500（分），价格变更 => 新 ID（官方无道具改/删 API）
export function boostPropIdFor(code: string, priceFen: number): string {
  const suffix = code
    .replace(/^BOOST_/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `bt_${suffix || 'x'}_p${priceFen}`;
}

export function yuanToFen(price: PricingConfig['price']): number {
  return Math.round(Number(price.toString()) * 100);
}

// 微信侧新道具发布确认后仍需传播：官方口径约 10~15 分钟，取 15 分钟保守值
const PROP_EFFECTIVE_DELAY_MS = 15 * 60 * 1000;
// SYNCING 超过该时长视为任务卡死（服务重启丢任务等），自动从头重跑
const SYNC_STALE_MS = 2 * 60 * 60 * 1000;

// XPAY 道具自动同步：官方没有道具读取/修改/禁用 API，改价只能「新增编码价格的新道具 + 发布」。
// 状态机（PricingConfig / BoostPlan 同构字段上）：null -> (begin) SYNCING/UPLOAD -> SYNCING/PUBLISH -> READY；API 失败 -> FAILED。
// 触发点：管理端改价 / 服务启动自愈 / 下单撞到价格切换抛 50008 时顺带重试 / 每分钟 cron 轮询任务结果。
// 两张表共用同一状态机：行被抽象成 PropSyncRow（快照 + update 闭包），表差异只存在于工厂函数。
// 微信批量任务单槽互斥：并发第二个报 268490012 频率限制，留 SYNCING 交给 cron 轮转。

// 状态机可写回行的全部字段
interface XpaySyncPatch {
  xpayProductId?: string;
  xpayPropStatus?: 'SYNCING' | 'READY' | 'FAILED';
  xpaySyncStep?: 'UPLOAD' | 'PUBLISH' | null;
  xpaySyncStartedAt?: Date;
  xpayPublishedAt?: Date | null;
  xpaySyncError?: string | null;
}

// 状态机的唯一操作面：一行待同步档位（表无关）
interface PropSyncRow {
  key: string; // 日志前缀：'D30' / 'BOOST_1D'
  id: string; // 行主键（update 的 where）
  target: string; // 按当前价格算出的目标道具 ID（每次构造行时重算，天然感知改价漂移）
  propName: string; // start_upload_goods 的 name（支付收据展示）
  propRemark: string; // start_upload_goods 的 remark
  itemUrl: string; // 道具图（恰好 200×200，微信硬性校验）
  imageEnv: string; // 图床 env 名（缺失时报错点名）
  snapshot: {
    xpayProductId: string | null;
    xpayPropStatus: string | null;
    xpaySyncStep: string | null;
    xpaySyncStartedAt: Date | null;
    xpayPublishedAt: Date | null;
  };
  update: (data: XpaySyncPatch) => Promise<unknown>;
}

@Injectable()
export class XpayPropSyncService implements OnModuleInit {
  private readonly logger = new Logger(XpayPropSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wxXPay: WxXPayService,
  ) {}

  onModuleInit(): void {
    // 启动自愈：有未完成/失败/未同步的档位就补跑（mock 模式跳过，dev 无凭证不打扰）
    if (!this.wxXPay.isReady()) return;
    void Promise.all([
      this.prisma.pricingConfig.findMany(),
      this.prisma.boostPlan.findMany(),
    ])
      .then(([pricings, plans]) =>
        Promise.all(
          [
            ...pricings.map((c) => this.pricingRow(c)),
            ...plans.map((p) => this.boostRow(p)),
          ].map((row) => this.beginRow(row).catch(() => {})),
        ),
      )
      .catch((e) => this.logger.warn(`道具同步启动自愈失败: ${String(e)}`));
  }

  // 每分钟轮询：推进 SYNCING 中的上传/发布任务（官方任务是异步的，只能查询结果）
  @Cron('20 * * * * *')
  async syncTick(): Promise<void> {
    if (!this.wxXPay.isReady()) return;
    const [pricings, plans] = await Promise.all([
      this.prisma.pricingConfig.findMany({ where: { xpayPropStatus: 'SYNCING' } }),
      this.prisma.boostPlan.findMany({ where: { xpayPropStatus: 'SYNCING' } }),
    ]);
    const rows = [
      ...pricings.map((c) => this.pricingRow(c)),
      ...plans.map((p) => this.boostRow(p)),
    ];
    for (const row of rows) {
      try {
        await this.advanceRow(row);
      } catch (e) {
        if (!this.isTaskRunningError(e)) {
          this.logger.warn(`道具同步轮询失败(${row.key}): ${this.errText(e)}`);
        }
      }
    }
  }

  // ===== 表工厂：表差异到此为止 =====

  private pricingItemUrl(): { itemUrl: string; imageEnv: string } {
    return {
      itemUrl: (this.config.get<string>('WX_XPAY_PROP_IMAGE_URL') ?? '').trim(),
      imageEnv: 'WX_XPAY_PROP_IMAGE_URL',
    };
  }

  private pricingRow(c: PricingConfig): PropSyncRow {
    const { itemUrl, imageEnv } = this.pricingItemUrl();
    return {
      key: c.duration,
      id: c.id,
      target: xpayPropIdFor(c.duration, yuanToFen(c.price)),
      propName: c.duration === JobDuration.D90 ? '岗位发布90天' : '岗位发布30天',
      propRemark: `兼职岗位发布费${c.price.toString()}元/${
        c.duration === JobDuration.D90 ? 90 : 30
      }天（价格变更自动生成，请勿在后台手动删除）`,
      itemUrl,
      imageEnv,
      snapshot: {
        xpayProductId: c.xpayProductId,
        xpayPropStatus: c.xpayPropStatus,
        xpaySyncStep: c.xpaySyncStep,
        xpaySyncStartedAt: c.xpaySyncStartedAt,
        xpayPublishedAt: c.xpayPublishedAt,
      },
      update: (data) => this.prisma.pricingConfig.update({ where: { id: c.id }, data }),
    };
  }

  private boostRow(p: BoostPlan): PropSyncRow {
    const itemUrl = (this.config.get<string>('WX_XPAY_BOOST_PROP_IMAGE_URL') ?? '').trim();
    return {
      key: p.code,
      id: p.id,
      target: boostPropIdFor(p.code, yuanToFen(p.price)),
      propName: p.name,
      propRemark: `内容推广费${p.price.toString()}元/${p.durationHours}小时（价格变更自动生成，请勿在后台手动删除）`,
      itemUrl,
      imageEnv: 'WX_XPAY_BOOST_PROP_IMAGE_URL',
      snapshot: {
        xpayProductId: p.xpayProductId,
        xpayPropStatus: p.xpayPropStatus,
        xpaySyncStep: p.xpaySyncStep,
        xpaySyncStartedAt: p.xpaySyncStartedAt,
        xpayPublishedAt: p.xpayPublishedAt,
      },
      update: (data) => this.prisma.boostPlan.update({ where: { id: p.id }, data }),
    };
  }

  // ===== 公开入口（签名稳定：payment.service / admin.service 调用点不变） =====

  // 岗位发布档位：确保道具可支付，未生效抛 50008 并顺带触发同步重试
  assertPropReadyOrThrow(pricing: PricingConfig): string {
    return this.assertRowReadyOrThrow(this.pricingRow(pricing));
  }

  // 推广档位：语义同上
  assertBoostPropReadyOrThrow(plan: BoostPlan): string {
    return this.assertRowReadyOrThrow(this.boostRow(plan));
  }

  // 启动一次同步（幂等）：岗位发布档位
  async beginSync(pricing: PricingConfig): Promise<void> {
    return this.beginRow(this.pricingRow(pricing));
  }

  // 启动一次同步（幂等）：推广档位
  async beginSyncBoostPlan(plan: BoostPlan): Promise<void> {
    return this.beginRow(this.boostRow(plan));
  }

  // ===== 状态机（表无关） =====

  // 确保道具处于可支付状态；未生效则抛 50008（前端 toast「当前支付人数过多，请稍后重试」，
  // 不向用户暴露道具同步内部状态），同时顺带触发一次同步重试（FAILED/未同步场景的自愈入口之一）。
  private assertRowReadyOrThrow(row: PropSyncRow): string {
    const s = row.snapshot;
    const effective =
      s.xpayProductId === row.target &&
      s.xpayPropStatus === 'READY' &&
      s.xpayPublishedAt !== null &&
      Date.now() - s.xpayPublishedAt.getTime() >= PROP_EFFECTIVE_DELAY_MS;
    if (effective) return row.target;
    if (s.xpayPropStatus !== 'SYNCING') {
      void this.beginRow(row).catch(() => {});
    }
    throw new BizException(
      XPAY_PRICE_SWITCHING_CODE,
      '当前支付人数过多，请稍后重试',
      HttpStatus.CONFLICT,
    );
  }

  // 启动一次同步（幂等）：目标道具已 READY 则不动；否则重置为 SYNCING/UPLOAD 并调上传 API。
  // 批量任务运行中（268490012）不算失败——留 SYNCING 交给 cron 重试。
  private async beginRow(row: PropSyncRow): Promise<void> {
    if (!this.wxXPay.isReady()) return;
    if (row.snapshot.xpayProductId === row.target && row.snapshot.xpayPropStatus === 'READY') return;

    if (!row.itemUrl) {
      await this.failRow(
        row,
        row.target,
        `缺少 ${row.imageEnv} 配置（道具图片必填，须恰好200*200的公网 jpg/png）`,
      );
      return;
    }
    await row.update({
      xpayProductId: row.target,
      xpayPropStatus: 'SYNCING',
      xpaySyncStep: 'UPLOAD',
      xpaySyncStartedAt: new Date(),
      xpaySyncError: null,
    });
    try {
      await this.wxXPay.startUploadGoods({
        id: row.target,
        name: row.propName,
        priceFen: Number(row.target.slice(row.target.lastIndexOf('_p') + 2)),
        remark: row.propRemark,
        itemUrl: row.itemUrl,
      });
      this.logger.log(`道具上传任务已启动: ${row.target}`);
    } catch (e) {
      if (!this.isTaskRunningError(e)) {
        await this.failRow(row, row.target, this.errText(e));
      }
      // 268490012：已有批量任务在跑，留 SYNCING 等 cron 查询/重试
    }
  }

  // 推进单个 SYNCING 档位：按 step 查询任务结果并转移状态
  private async advanceRow(row: PropSyncRow): Promise<void> {
    const s = row.snapshot;
    if (s.xpayProductId === null || s.xpaySyncStep === null) return;
    // 同步期间价格又被改了：目标道具已变，从头重跑
    if (s.xpayProductId !== row.target) {
      await this.beginRow(row);
      return;
    }
    // 卡死保护：超过 SYNC_STALE_MS 重新开始
    if (s.xpaySyncStartedAt !== null && Date.now() - s.xpaySyncStartedAt.getTime() > SYNC_STALE_MS) {
      await this.beginRow(row);
      return;
    }

    if (s.xpaySyncStep === 'UPLOAD') {
      const q = await this.wxXPay.queryUploadGoods();
      const it = q.items.find((i) => i.id === row.target);
      if (!it) {
        // 任务已不在运行但列表里没有本道具 => 任务丢失，重启上传
        if (q.status !== 1) await this.beginRow(row);
        return;
      }
      if (it.uploadStatus === 2 || it.uploadStatus === 1) {
        // 上传成功 / id已存在（含历史上传过）=> 进入发布
        await row.update({ xpaySyncStep: 'PUBLISH' });
        try {
          await this.wxXPay.startPublishGoods(row.target);
          this.logger.log(`道具发布任务已启动: ${row.target}`);
        } catch (e) {
          if (!this.isTaskRunningError(e)) {
            await this.failRow(row, row.target, this.errText(e));
          }
        }
      } else if (it.uploadStatus === 3) {
        await this.failRow(row, row.target, `上传失败：${it.errmsg ?? '未知原因'}`);
      }
      // 0=上传中，等下轮
      return;
    }

    // step === 'PUBLISH'
    const q = await this.wxXPay.queryPublishGoods();
    const it = q.items.find((i) => i.id === row.target);
    if (!it) {
      if (q.status !== 1) {
        try {
          await this.wxXPay.startPublishGoods(row.target);
        } catch (e) {
          if (!this.isTaskRunningError(e)) {
            await this.failRow(row, row.target, this.errText(e));
          }
        }
      }
      return;
    }
    if (it.publishStatus === 2 || it.publishStatus === 1) {
      // 发布成功 / id已存在（此前已发布过）=> READY（下单侧还有 15 分钟生效缓冲）
      await row.update({
        xpayProductId: row.target,
        xpayPropStatus: 'READY',
        xpaySyncStep: null,
        xpayPublishedAt: new Date(),
        xpaySyncError: null,
      });
      this.logger.log(`道具发布完成: ${row.target}（约15分钟后支付网关生效）`);
    } else if (it.publishStatus === 3) {
      await this.failRow(row, row.target, `发布失败：${it.errmsg ?? '未知原因'}`);
    }
  }

  private async failRow(row: PropSyncRow, target: string, msg: string): Promise<void> {
    this.logger.error(`道具同步失败 ${target}: ${msg}`);
    await row.update({ xpayPropStatus: 'FAILED', xpaySyncError: msg.slice(0, 500) });
  }

  // 268490012 批量任务运行中：request() 会包成 90003 + errmsg，无法拿原始 errcode，按文案兜底识别
  private isTaskRunningError(e: unknown): boolean {
    const t = this.errText(e);
    return t.includes('268490012') || t.includes('任务运行中');
  }

  private errText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
