import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { JobDuration, type PricingConfig } from '@prisma/client';
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

export function yuanToFen(price: PricingConfig['price']): number {
  return Math.round(Number(price.toString()) * 100);
}

// 微信侧新道具发布确认后仍需传播：官方口径约 10~15 分钟，取 15 分钟保守值
const PROP_EFFECTIVE_DELAY_MS = 15 * 60 * 1000;
// SYNCING 超过该时长视为任务卡死（服务重启丢任务等），自动从头重跑
const SYNC_STALE_MS = 2 * 60 * 60 * 1000;

// XPAY 道具自动同步：官方没有道具读取/修改/禁用 API，改价只能「新增编码价格的新道具 + 发布」。
// 状态机（PricingConfig 上）：null -> (beginSync) SYNCING/UPLOAD -> SYNCING/PUBLISH -> READY；API 失败 -> FAILED。
// 触发点：管理端改价 / 服务启动自愈 / 下单撞到价格切换抛 50008 时顺带重试 / 每分钟 cron 轮询任务结果。
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
    void this.prisma.pricingConfig
      .findMany()
      .then((list) => Promise.all(list.map((c) => this.beginSync(c).catch(() => {}))))
      .catch((e) => this.logger.warn(`道具同步启动自愈失败: ${String(e)}`));
  }

  // 每分钟轮询：推进 SYNCING 中的上传/发布任务（官方任务是异步的，只能查询结果）
  @Cron('20 * * * * *')
  async syncTick(): Promise<void> {
    if (!this.wxXPay.isReady()) return;
    const list = await this.prisma.pricingConfig.findMany({
      where: { xpayPropStatus: 'SYNCING' },
    });
    for (const c of list) {
      try {
        await this.advance(c);
      } catch (e) {
        if (!this.isTaskRunningError(e)) {
          this.logger.warn(`道具同步轮询失败(${c.duration}): ${this.errText(e)}`);
        }
      }
    }
  }

  // 确保某档位价格对应的道具处于可支付状态；未生效则抛 50008（前端 toast「当前支付人数过多，请稍后重试」，
  // 不向用户暴露道具同步内部状态），
  // 同时顺带触发一次同步重试（FAILED/未同步场景的自愈入口之一）。
  assertPropReadyOrThrow(pricing: PricingConfig): string {
    const target = xpayPropIdFor(pricing.duration, yuanToFen(pricing.price));
    const effective =
      pricing.xpayProductId === target &&
      pricing.xpayPropStatus === 'READY' &&
      pricing.xpayPublishedAt !== null &&
      Date.now() - pricing.xpayPublishedAt.getTime() >= PROP_EFFECTIVE_DELAY_MS;
    if (effective) return target;
    if (pricing.xpayPropStatus !== 'SYNCING') {
      void this.beginSync(pricing).catch(() => {});
    }
    throw new BizException(
      XPAY_PRICE_SWITCHING_CODE,
      '当前支付人数过多，请稍后重试',
      HttpStatus.CONFLICT,
    );
  }

  // 启动一次同步（幂等）：目标道具已 READY 则不动；否则重置为 SYNCING/UPLOAD 并调上传 API。
  // 批量任务运行中（268490012）不算失败——留 SYNCING 交给 cron 重试。
  async beginSync(pricing: PricingConfig): Promise<void> {
    if (!this.wxXPay.isReady()) return;
    const target = xpayPropIdFor(pricing.duration, yuanToFen(pricing.price));
    if (pricing.xpayProductId === target && pricing.xpayPropStatus === 'READY') return;

    const itemUrl = (this.config.get<string>('WX_XPAY_PROP_IMAGE_URL') ?? '').trim();
    if (!itemUrl) {
      await this.markFailed(
        pricing.id,
        target,
        '缺少 WX_XPAY_PROP_IMAGE_URL 配置（道具图片必填，需公网 jpg/png）',
      );
      return;
    }
    await this.prisma.pricingConfig.update({
      where: { id: pricing.id },
      data: {
        xpayProductId: target,
        xpayPropStatus: 'SYNCING',
        xpaySyncStep: 'UPLOAD',
        xpaySyncStartedAt: new Date(),
        xpaySyncError: null,
      },
    });
    try {
      await this.wxXPay.startUploadGoods({
        id: target,
        name: pricing.duration === JobDuration.D90 ? '岗位发布90天' : '岗位发布30天',
        priceFen: yuanToFen(pricing.price),
        remark: `兼职岗位发布费${pricing.price.toString()}元/${
          pricing.duration === JobDuration.D90 ? 90 : 30
        }天（价格变更自动生成，请勿在后台手动删除）`,
        itemUrl,
      });
      this.logger.log(`道具上传任务已启动: ${target}`);
    } catch (e) {
      if (!this.isTaskRunningError(e)) {
        await this.markFailed(pricing.id, target, this.errText(e));
      }
      // 268490012：已有批量任务在跑，留 SYNCING 等 cron 查询/重试
    }
  }

  // 推进单个 SYNCING 档位：按 step 查询任务结果并转移状态
  private async advance(pricing: PricingConfig): Promise<void> {
    if (pricing.xpayProductId === null || pricing.xpaySyncStep === null) return;
    // 同步期间价格又被改了：目标道具已变，从头重跑
    const target = xpayPropIdFor(pricing.duration, yuanToFen(pricing.price));
    if (pricing.xpayProductId !== target) {
      await this.beginSync(pricing);
      return;
    }
    // 卡死保护：超过 SYNC_STALE_MS 重新开始
    if (
      pricing.xpaySyncStartedAt !== null &&
      Date.now() - pricing.xpaySyncStartedAt.getTime() > SYNC_STALE_MS
    ) {
      await this.beginSync(pricing);
      return;
    }

    if (pricing.xpaySyncStep === 'UPLOAD') {
      const q = await this.wxXPay.queryUploadGoods();
      const it = q.items.find((i) => i.id === target);
      if (!it) {
        // 任务已不在运行但列表里没有本道具 => 任务丢失，重启上传
        if (q.status !== 1) await this.beginSync(pricing);
        return;
      }
      if (it.uploadStatus === 2 || it.uploadStatus === 1) {
        // 上传成功 / id已存在（含历史上传过）=> 进入发布
        await this.prisma.pricingConfig.update({
          where: { id: pricing.id },
          data: { xpaySyncStep: 'PUBLISH' },
        });
        try {
          await this.wxXPay.startPublishGoods(target);
          this.logger.log(`道具发布任务已启动: ${target}`);
        } catch (e) {
          if (!this.isTaskRunningError(e)) {
            await this.markFailed(pricing.id, target, this.errText(e));
          }
        }
      } else if (it.uploadStatus === 3) {
        await this.markFailed(pricing.id, target, `上传失败：${it.errmsg ?? '未知原因'}`);
      }
      // 0=上传中，等下轮
      return;
    }

    // step === 'PUBLISH'
    const q = await this.wxXPay.queryPublishGoods();
    const it = q.items.find((i) => i.id === target);
    if (!it) {
      if (q.status !== 1) {
        try {
          await this.wxXPay.startPublishGoods(target);
        } catch (e) {
          if (!this.isTaskRunningError(e)) {
            await this.markFailed(pricing.id, target, this.errText(e));
          }
        }
      }
      return;
    }
    if (it.publishStatus === 2 || it.publishStatus === 1) {
      // 发布成功 / id已存在（此前已发布过）=> READY（下单侧还有 15 分钟生效缓冲）
      await this.prisma.pricingConfig.update({
        where: { id: pricing.id },
        data: {
          xpayProductId: target,
          xpayPropStatus: 'READY',
          xpaySyncStep: null,
          xpayPublishedAt: new Date(),
          xpaySyncError: null,
        },
      });
      this.logger.log(`道具发布完成: ${target}（约15分钟后支付网关生效）`);
    } else if (it.publishStatus === 3) {
      await this.markFailed(pricing.id, target, `发布失败：${it.errmsg ?? '未知原因'}`);
    }
  }

  private async markFailed(configId: string, target: string, msg: string): Promise<void> {
    this.logger.error(`道具同步失败 ${target}: ${msg}`);
    await this.prisma.pricingConfig.update({
      where: { id: configId },
      data: { xpayPropStatus: 'FAILED', xpaySyncError: msg.slice(0, 500) },
    });
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
