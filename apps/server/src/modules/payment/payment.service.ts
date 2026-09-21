import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  CommunityMemberRole,
  JobDuration,
  MerchantStatus,
  JobPostStatus,
  PayChannel,
  PayScene,
  PayStatus,
  PostStatus,
  PostVisibility,
  type PaymentOrder,
  type PublicationScope,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { WxPayService } from '../../common/wx/wx-pay.service';
import { WxXPayService } from '../../common/wx/wx-xpay.service';
import { XpayPropSyncService, xpayPropIdFor } from './xpay-prop-sync.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import { BoostService, type BoostTargetType } from '../boost/boost.service';
import { ConfessionService } from '../confession/confession.service';
import { PublicationPolicyService } from '../publication/publication-policy.service';
import type { CreateBoostOrderDto } from './dto/boost.dto';
import type { PublishJobDto } from './dto/payment.dto';

// 错误码 5xxxx 支付段（API §3）：50001 订单不存在 / 50002 订单已完成或无效 / 50003 金额不匹配 / 50004 单价未配置 / 50005 退款不可用 / 50006 推广档位不存在或已下架 / 50007 内容不可推广 / 50008 新道具未生效（对用户提示「当前支付人数过多，请稍后重试」）

// 岗位付费发布道具 ID 不再静态映射，由 XpayPropSyncService 按价格动态生成（jp_d30_p9000，价格编码进 ID）。
// 管理端改价后自动上传+发布新道具；微信侧约 10~15 分钟生效，期间下单抛 50008（提示「当前支付人数过多，请稍后重试」）。
// 详见 xpay-prop-sync.service.ts。

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wxPay: WxPayService,
    private readonly wxXPay: WxXPayService,
    private readonly xpayPropSync: XpayPropSyncService,
    private readonly notification: NotificationService,
    private readonly boost: BoostService,
    private readonly confession: ConfessionService,
    @Optional() private readonly publication?: PublicationPolicyService,
  ) {}

  private get publicationPolicy(): PublicationPolicyService {
    return this.publication ?? new PublicationPolicyService(this.prisma);
  }

  // ===== 兼职付费发布（JOB_PUBLISH）=====

  // 免支付发岗公共流程：建 waived 订单 → 直接履约（PAID + 岗位直发），响应结构同付费下单。
  // 适用两类身份（P2-64）：平台管理员（AdminUser + adminType.isPlatform，任意圈子全免）、
  // 圈子管理员/圈主（CommunityMember.role ∈ OWNER/ADMIN，仅发到自己管理的圈子免）。
  // 前端发布页凭本响应 jobPostStatus=PUBLISHED 直接提示发布成功，否则进支付页。
  private async fulfillWaivedJobPublishOrder(
    merchantId: string,
    jobPostId: string,
    duration: JobDuration,
    price: Prisma.Decimal,
    waivedBy: string,
  ) {
    const order = await this.prisma.paymentOrder.create({
      data: {
        scene: PayScene.JOB_PUBLISH,
        channel: PayChannel.XPAY,
        merchantId,
        jobPostId,
        duration,
        amount: price,
        status: PayStatus.PENDING,
        waived: true,
      },
    });
    await this.fulfillOrder(order.id);
    const done = await this.prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
    this.logger.log(`${waivedBy}免支付发岗: order=${order.id} job=${jobPostId}`);
    return {
      orderId: order.id,
      amount: done.amount.toString(),
      status: done.status,
      jobPostId,
      jobPostStatus: JobPostStatus.PUBLISHED,
      virtualPayParams: null,
      wxPayParams: null,
      waived: true,
    };
  }

  // 付费发布：按 PricingConfig 计价下单。金额服务端算，不信前端。
  // - 凭证齐全（isReady）：虚拟支付道具直购下单，返回 virtualPayParams 供前端 wx.requestVirtualPayment；
  //   订单留 PENDING，等消息推送发货回调（xpay_goods_deliver_notify）或前端支付成功后的 sync 兜底对账置 PAID。
  // - 凭证缺失 + dev：mock 支付自动完成（置 PAID）。
  // - 凭证缺失 + prod：抛 90003。
  async createJobPublishOrder(merchantUid: string, dto: PublishJobDto) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    if (merchant.status !== MerchantStatus.APPROVED) throw new BizException(60003, '商家资质未审核通过', HttpStatus.FORBIDDEN);

    const post = await this.prisma.jobPost.findUnique({ where: { id: dto.jobPostId } });
    if (!post) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
    if (post.merchantId !== merchant.id) {
      throw new BizException(10003, '无权操作该岗位', HttpStatus.FORBIDDEN);
    }
    await this.publicationPolicy.assertOwnerCanManage(merchantUid, post.publisherScope);
    await this.publicationPolicy.assertCommunityInteractionAllowed(merchantUid, post.communityId);
    if (post.status !== JobPostStatus.PENDING) {
      throw new BizException(50002, '岗位已发布或已下架，无需再次付费', HttpStatus.CONFLICT);
    }

    const pricing = await this.prisma.pricingConfig.findUnique({ where: { duration: dto.duration } });
    if (!pricing) throw new BizException(50004, '该档位单价未配置', HttpStatus.CONFLICT);

    // 免支付发岗两类身份（P2-64）：校验流程照走，不进支付页，订单直接 PAID + 岗位直发。
    // 1) 平台管理员：任意圈子全免。判定必须用 AdminUser + adminType.isPlatform（与
    //    publication-policy.isPlatformUser 同口径）——不能用 user_roles.role=ADMIN：
    //    createAdmin 给圈子管理员建档时同样写该角色，误判会导致圈子管理员全圈子免支付。
    // 2) 圈子管理员/圈主（CommunityMember.role ∈ OWNER/ADMIN）：仅发到自己管理的圈子免，其他圈子照常付费。
    if (await this.publicationPolicy.isPlatformUser(merchantUid)) {
      return this.fulfillWaivedJobPublishOrder(merchant.id, post.id, dto.duration, pricing.price, '平台管理员');
    }
    if (post.communityId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: post.communityId, userId: merchantUid } },
        select: { role: true },
      });
      if (
        membership
        && (membership.role === CommunityMemberRole.OWNER || membership.role === CommunityMemberRole.ADMIN)
      ) {
        return this.fulfillWaivedJobPublishOrder(merchant.id, post.id, dto.duration, pricing.price, '圈子管理员');
      }
    }

    // 道具守卫：改价后新道具未在微信支付网关生效（约10~15分钟）时抛 50008（提示「当前支付人数过多，请稍后重试」），顺带触发同步重试
    const propId = this.wxXPay.isReady() ? this.xpayPropSync.assertPropReadyOrThrow(pricing) : '';

    const pendingWhere = {
      scene: PayScene.JOB_PUBLISH,
      merchantId: merchant.id,
      jobPostId: post.id,
      duration: dto.duration,
      status: PayStatus.PENDING,
    } as const;
    let order = await this.prisma.paymentOrder.findFirst({
      where: pendingWhere,
      orderBy: { createdAt: 'desc' },
    });
    if (!order) {
      try {
        order = await this.prisma.paymentOrder.create({
          data: {
            scene: PayScene.JOB_PUBLISH,
            channel: PayChannel.XPAY,
            merchantId: merchant.id,
            jobPostId: post.id,
            duration: dto.duration,
            amount: pricing.price,
            status: PayStatus.PENDING,
          },
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error;
        order = await this.prisma.paymentOrder.findFirst({
          where: pendingWhere,
          orderBy: { createdAt: 'desc' },
        });
        if (!order) throw error;
      }
    }
    // dev mock：直接完成（是否 mock 只看虚拟支付凭证，与 V3 凭证无关）
    if (!this.wxXPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信虚拟支付凭证未配置，无法发起支付', HttpStatus.SERVICE_UNAVAILABLE);
      }
      this.logger.warn('dev mode: mock pay & publish (xpay)');
      await this.fulfillOrder(order.id);
      const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
      return {
        orderId: order.id,
        amount: refreshed!.amount.toString(),
        status: refreshed!.status,
        jobPostId: post.id,
        jobPostStatus: JobPostStatus.PUBLISHED,
        virtualPayParams: null,
        wxPayParams: null,
      };
    }

    // 真实虚拟支付（道具直购）：三要素由后端算好，前端原样透传 wx.requestVirtualPayment（禁止重新序列化 signData）
    const user = await this.prisma.user.findUnique({
      where: { id: merchantUid },
      select: { openid: true, sessionKey: true },
    });
    if (!user?.openid) {
      throw new BizException(90003, '商家 openid 缺失，无法发起微信支付', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!user.sessionKey) {
      // session_key 过期/缺失：用户态签名会验签失败，引导用户重新进入小程序刷新登录态
      throw new BizException(90003, '微信登录态已过期，请退出小程序重新进入后再支付', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const amountInFen = Math.round(Number(order.amount.toString()) * 100);
    const virtualPayParams = this.wxXPay.buildGoodsPayParams({
      outTradeNo: order.id,
      goodsPriceFen: amountInFen,
      productId: propId,
      sessionKey: user.sessionKey,
    });
    return {
      orderId: order.id,
      amount: order.amount.toString(),
      status: PayStatus.PENDING,
      jobPostId: post.id,
      jobPostStatus: JobPostStatus.PENDING,
      virtualPayParams,
      wxPayParams: null,
    };
  }

  // 发布岗位单价预览（D30/D90）：商家支付页展示用，金额服务端按 PricingConfig 算，不下单
  async getJobPublishPricing() {
    const list = await this.prisma.pricingConfig.findMany();
    return list.map((p) => ({ duration: p.duration, price: p.price.toString() }));
  }

  // ===== 内容推广（POST_BOOST / ANON_POST_BOOST）=====

  // 付费提升曝光：按 BoostPlan 档位计价下单。金额服务端按 plan.price 算，不信前端。
  // 树洞匿名红线：真实用户用 access token 付费（微信支付需 openid），订单记真实 userId（后台可追溯），
  // AnonymousPost 表保持 0 真实 uid，仅校验 AnonymousProfile.userId ↔ anonId 归属。
  async createBoostOrder(uid: string, dto: CreateBoostOrderDto) {
    const plan = await this.boost.getPlan(dto.planCode); // 50006 缺失/下架

    // 归属 + 可推广校验
    let postId: string | null = null;
    let anonPostId: string | null = null;
    if (dto.targetType === 'post') {
      const post = await this.prisma.post.findUnique({ where: { id: dto.targetId } });
      if (!post || post.authorId !== uid) {
        throw new BizException(10003, '无权推广该内容', HttpStatus.FORBIDDEN);
      }
      await this.publicationPolicy.assertOwnerCanManage(uid, post.publisherScope);
      await this.publicationPolicy.assertCommunityInteractionAllowed(uid, post.communityId);
      if (post.status !== PostStatus.APPROVED || post.visibility !== PostVisibility.PUBLIC || post.deletedAt) {
        throw new BizException(50007, '该内容当前不可推广', HttpStatus.CONFLICT);
      }
      postId = post.id;
    } else {
      const profile = await this.prisma.anonymousProfile.findFirst({ where: { userId: uid } });
      const anonPost = await this.prisma.anonymousPost.findUnique({ where: { id: dto.targetId } });
      if (!anonPost || !profile || anonPost.anonId !== profile.anonId) {
        throw new BizException(10003, '无权推广该内容', HttpStatus.FORBIDDEN);
      }
      await this.publicationPolicy.assertOwnerCanManage(uid, anonPost.publisherScope);
      await this.publicationPolicy.assertCommunityInteractionAllowed(uid, anonPost.communityId);
      if (anonPost.status !== PostStatus.APPROVED) {
        throw new BizException(50007, '该内容当前不可推广', HttpStatus.CONFLICT);
      }
      anonPostId = anonPost.id;
    }

    // 道具守卫：改价后新道具未在微信支付网关生效（约10~15分钟）时抛 50008（提示「当前支付人数过多，请稍后重试」），顺带触发同步重试
    const propId = this.wxXPay.isReady() ? this.xpayPropSync.assertBoostPropReadyOrThrow(plan) : '';

    const pendingWhere = {
      scene: dto.targetType === 'post' ? PayScene.POST_BOOST : PayScene.ANON_POST_BOOST,
      userId: uid,
      postId,
      anonPostId,
      boostPlanId: plan.id,
      status: PayStatus.PENDING,
    } as const;
    let order = await this.prisma.paymentOrder.findFirst({
      where: pendingWhere,
      orderBy: { createdAt: 'desc' },
    });
    if (!order) {
      try {
        order = await this.prisma.paymentOrder.create({
          data: {
            scene: dto.targetType === 'post' ? PayScene.POST_BOOST : PayScene.ANON_POST_BOOST,
            channel: PayChannel.XPAY,
            userId: uid,
            postId,
            anonPostId,
            boostPlanId: plan.id,
            amount: plan.price,
            status: PayStatus.PENDING,
          },
        });
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error;
        order = await this.prisma.paymentOrder.findFirst({
          where: pendingWhere,
          orderBy: { createdAt: 'desc' },
        });
        if (!order) throw error;
      }
    }
    // dev mock：直接完成（是否 mock 只看虚拟支付凭证，与 V3 凭证无关）
    if (!this.wxXPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, '微信虚拟支付凭证未配置，无法发起支付', HttpStatus.SERVICE_UNAVAILABLE);
      }
      this.logger.warn('dev mode: mock pay & boost');
      await this.fulfillOrder(order.id);
      const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
      const target = await this.getBoostTarget(dto.targetType, dto.targetId);
      return {
        orderId: order.id,
        amount: refreshed!.amount.toString(),
        status: refreshed!.status,
        targetType: dto.targetType,
        targetId: dto.targetId,
        boostUntil: target?.boostUntil?.toISOString() ?? null,
        virtualPayParams: null,
      };
    }

    // 真实虚拟支付（道具直购）：三要素由后端算好，前端原样透传 wx.requestVirtualPayment（禁止重新序列化 signData）
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { openid: true, sessionKey: true },
    });
    if (!user?.openid) {
      throw new BizException(90003, '用户 openid 缺失，无法发起微信支付', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!user.sessionKey) {
      // session_key 过期/缺失：用户态签名会验签失败，引导用户重新进入小程序刷新登录态
      throw new BizException(90003, '微信登录态已过期，请退出小程序重新进入后再支付', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const amountInFen = Math.round(Number(order.amount.toString()) * 100);
    const virtualPayParams = this.wxXPay.buildGoodsPayParams({
      outTradeNo: order.id,
      goodsPriceFen: amountInFen,
      productId: propId,
      sessionKey: user.sessionKey,
    });
    return {
      orderId: order.id,
      amount: order.amount.toString(),
      status: PayStatus.PENDING,
      targetType: dto.targetType,
      targetId: dto.targetId,
      boostUntil: null,
      virtualPayParams,
    };
  }

  // ===== 完成 / 退款（按 scene 分支）=====

  // 完成订单（幂等）：置 PAID + 按场景生效——JOB 岗位 PUBLISHED + expireAt；boost applyBoost（置顶到期时间）。
  async fulfillOrder(orderId: string, wxTransactionId?: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    if (order.status !== PayStatus.PENDING) return; // 已完成，幂等

    if (order.scene === PayScene.JOB_PUBLISH) {
      const merchantId = order.merchantId;
      const jobPostId = order.jobPostId;
      if (!merchantId) {
        throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
      }
      if (!jobPostId) {
        throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
      }
      const governedPost = await this.prisma.jobPost.findUnique({
        where: { id: jobPostId },
        select: { publisherScope: true },
      });
      if (!governedPost) throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
      const days = order.duration === JobDuration.D90 ? 90 : 30;
      const expireAt = new Date(Date.now() + days * 86_400_000);
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { userId: true, contactPhone: true, contactWechat: true },
      });
      if (!merchant) {
        throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
      }
      const fulfilled = await this.prisma.$transaction(async (tx) => {
        const [lockedPost] = await tx.$queryRawUnsafe<Array<{
          id: string;
          publisherScope: PublicationScope;
          communityId: string;
        }>>(
          `SELECT "id",
                  "publisher_scope" AS "publisherScope",
                  "community_id" AS "communityId"
           FROM "job_posts"
           WHERE "id" = $1
           FOR UPDATE`,
          jobPostId,
        );
        if (!lockedPost) {
          throw new BizException(40001, '岗位不存在', HttpStatus.NOT_FOUND);
        }
        const claimed = await tx.paymentOrder.updateMany({
          where: { id: orderId, status: PayStatus.PENDING },
          data: {
            status: PayStatus.PAID,
            paidAt: new Date(),
            wxTransactionId: wxTransactionId ?? order.wxTransactionId,
            fulfillmentApplied: true,
          },
        });
        if (claimed.count !== 1) return false;
        await this.publicationPolicy.assertOwnerCanManageInTransaction(
          tx,
          merchant.userId,
          lockedPost.publisherScope,
        );
        await this.publicationPolicy.assertCommunityInteractionAllowedInTransaction(
          tx,
          merchant.userId,
          lockedPost.communityId,
        );
        const published = await tx.jobPost.updateMany({
          where: {
            id: jobPostId,
            status: JobPostStatus.PENDING,
            moderationAuthority: null,
          },
          data: {
            status: JobPostStatus.PUBLISHED,
            expireAt,
            contactPhoneSnapshot: merchant.contactPhone,
            contactWechatSnapshot: merchant.contactWechat,
          },
        });
        if (published.count !== 1) {
          throw new BizException(40004, '岗位状态已变更，请刷新后重试', HttpStatus.CONFLICT);
        }
        return true;
      });
      if (!fulfilled) return;
      // 主动通知商家发布成功（PaymentOrder 无 relation，经 jobPost 取 merchant.userId）
      const post = await this.prisma.jobPost.findUnique({
        where: { id: jobPostId },
        include: { merchant: { select: { userId: true } } },
      });
      if (post?.merchant) {
        void this.notification
          .create({
            userId: post.merchant.userId,
            type: NotificationType.PAYMENT_PAID,
            title: '兼职 · 岗位已发布',
            content: `你的岗位「${post.title}」已支付成功并发布`,
            targetType: 'job_post',
            targetId: post.id,
          })
          .catch((e: unknown) =>
            this.logger.warn(`notify payment paid failed: ${e instanceof Error ? e.message : String(e)}`),
          );
      }
      return;
    }

    // boost 场景：事务内置 PAID + 应用推广；金额在 create 时已按档位算，此处只消费计划时长
    const plan = order.boostPlanId
      ? await this.prisma.boostPlan.findUnique({ where: { id: order.boostPlanId } })
      : null;
    if (!plan) throw new BizException(50006, '推广档位不存在', HttpStatus.NOT_FOUND);
    const targetType: BoostTargetType = order.scene === PayScene.POST_BOOST ? 'post' : 'anon_post';
    const targetId = targetType === 'post' ? order.postId! : order.anonPostId!;
    if (!order.userId) throw new BizException(50007, '推广内容不存在', HttpStatus.NOT_FOUND);
    const fulfilled = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentOrder.updateMany({
        where: { id: orderId, status: PayStatus.PENDING },
        data: {
            status: PayStatus.PAID,
            paidAt: new Date(),
            wxTransactionId: wxTransactionId ?? order.wxTransactionId,
            fulfillmentApplied: true,
          },
      });
      if (claimed.count !== 1) return false;
      const lockedTarget = await this.lockBoostTargetForFulfillment(
        tx,
        targetType,
        targetId,
      );
      await this.publicationPolicy.assertOwnerCanManageInTransaction(
        tx,
        order.userId!,
        lockedTarget.publisherScope,
      );
      await this.publicationPolicy.assertCommunityInteractionAllowedInTransaction(
        tx,
        order.userId!,
        lockedTarget.communityId,
      );
      await this.boost.applyBoost(targetType, targetId, plan.durationHours, tx);
      return true;
    });
    if (!fulfilled) return;
    // 推广影响各 feed 首屏排序，失效列表缓存
    this.confession.invalidateFeedCache();
  }

  // 微信支付回调（V3 JSON 加密报文，prod）：验签 + 解密 + trade_state=SUCCESS -> fulfillOrder。
  // 返回 {code,message}，由 controller 转 HTTP 200/500（V3 失败非 2xx 让微信重试）。
  async notify(
    rawBody: string,
    headers: { timestamp?: string; nonce?: string; signature?: string },
  ): Promise<{ code: string; message: string }> {
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        return { code: 'FAIL', message: '微信支付回调未接入' };
      }
      // dev 直达：body 内带 orderId（mock-pay / 手动测试用）
      let orderId = '';
      try {
        const data = JSON.parse(rawBody) as { out_trade_no?: string; orderId?: string };
        orderId = data.out_trade_no ?? data.orderId ?? '';
      } catch {
        /* ignore */
      }
      if (!orderId) return { code: 'FAIL', message: 'no orderId' };
      await this.fulfillOrder(orderId);
      return { code: 'SUCCESS', message: 'OK' };
    }
    try {
      const dec = this.wxPay.verifyAndParseCallback(headers, rawBody);
      const orderId = typeof dec.out_trade_no === 'string' ? dec.out_trade_no : '';
      if (!orderId) return { code: 'FAIL', message: 'no out_trade_no' };
      if (dec.trade_state !== 'SUCCESS') {
        return { code: 'SUCCESS', message: 'ignored: trade_state not SUCCESS' };
      }
      const transactionId = typeof dec.transaction_id === 'string' ? dec.transaction_id : undefined;
      const retriedRefund = await this.retryRequiredFulfillmentRefund(orderId);
      if (retriedRefund) {
        return { code: 'SUCCESS', message: `payment refund ${retriedRefund.toLowerCase()}` };
      }
      try {
        await this.fulfillOrder(orderId, transactionId);
      } catch (e) {
        if (!(e instanceof BizException)) throw e;
        const refundStatus = await this.recordPaidFulfillmentFailure(orderId, transactionId, e);
        return { code: 'SUCCESS', message: `payment refund ${refundStatus.toLowerCase()}` };
      }
      return { code: 'SUCCESS', message: 'OK' };
    } catch (e) {
      return { code: 'FAIL', message: (e as Error).message };
    }
  }

  private async recordPaidFulfillmentFailure(
    orderId: string,
    wxTransactionId: string | undefined,
    error: BizException,
  ): Promise<PayStatus> {
    const refundReason = `支付成功但履约失败：${error.message}`.slice(0, 500);
    const claimed = await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: PayStatus.PENDING },
      data: {
        status: PayStatus.PAID,
        paidAt: new Date(),
        ...(wxTransactionId ? { wxTransactionId } : {}),
        refundStatus: 'REQUIRED',
        refundReason,
        fulfillmentApplied: false,
        refundAttempt: 1,
        refundRetryAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      const current = await this.prisma.paymentOrder.findUnique({
        where: { id: orderId },
        select: { status: true, refundStatus: true },
      });
      if (!current || current.status === PayStatus.PENDING) throw error;
      if (current.status !== PayStatus.PAID || current.refundStatus !== 'REQUIRED') {
        return current.status;
      }
    } else {
      this.logger.error(`payment ${orderId} paid but fulfillment failed; starting refund: ${error.message}`);
    }
    return (await this.retryRequiredFulfillmentRefund(orderId)) ?? PayStatus.PAID;
  }

  private async retryRequiredFulfillmentRefund(orderId: string): Promise<PayStatus | null> {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== PayStatus.PAID || order.refundStatus !== 'REQUIRED') return null;

    let refundResult: { refundId: string; status: string };
    try {
      refundResult = await this.startChannelRefund(
        order,
        `${order.id}_R${Math.max(1, order.refundAttempt)}`,
        order.refundReason ?? '支付成功但内容未生效，自动退款',
      );
    } catch (error) {
      await this.prisma.paymentOrder.updateMany({
        where: {
          id: orderId,
          status: PayStatus.PAID,
          refundStatus: 'REQUIRED',
          refundAttempt: order.refundAttempt,
        },
        data: { refundRetryAt: new Date(Date.now() + 5 * 60_000) },
      });
      throw error;
    }
    const { refundId, status } = refundResult;
    if (status === 'SUCCESS') {
      const updated = await this.prisma.paymentOrder.updateMany({
        where: { id: orderId, status: PayStatus.PAID, refundStatus: 'REQUIRED' },
        data: {
          status: PayStatus.REFUNDED,
          refundedAt: new Date(),
          refundStatus: status,
          ...(refundId ? { wxRefundId: refundId } : {}),
        },
      });
      if (updated.count === 1) return PayStatus.REFUNDED;
    } else if (status === 'PROCESSING') {
      const updated = await this.prisma.paymentOrder.updateMany({
        where: {
          id: orderId,
          status: PayStatus.PAID,
          refundStatus: 'REQUIRED',
          refundAttempt: order.refundAttempt,
        },
        data: {
          status: PayStatus.REFUNDING,
          refundStatus: status,
          ...(refundId ? { wxRefundId: refundId } : {}),
        },
      });
      if (updated.count === 1) return PayStatus.REFUNDING;
    } else {
      await this.prisma.paymentOrder.updateMany({
        where: {
          id: orderId,
          status: PayStatus.PAID,
          refundStatus: 'REQUIRED',
          refundAttempt: order.refundAttempt,
        },
        data: {
          refundReason: `${order.refundReason ?? '自动退款'}；退款状态 ${status}`.slice(0, 500),
          refundRetryAt: new Date(Date.now() + 5 * 60_000),
          ...(status === 'CLOSED' ? { refundAttempt: { increment: 1 } } : {}),
          ...(refundId ? { wxRefundId: refundId } : {}),
        },
      });
      throw new Error(`automatic refund ${status.toLowerCase()}`);
    }

    const current = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!current) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    return current.status;
  }

  @Cron('0 */5 * * * *')
  async retryRequiredFulfillmentRefunds(): Promise<void> {
    if (!this.wxPay.isReady() && !this.wxXPay.isReady()) return;
    const orders = await this.prisma.paymentOrder.findMany({
      where: {
        status: PayStatus.PAID,
        refundStatus: 'REQUIRED',
        refundRetryAt: { lte: new Date() },
      },
      orderBy: [{ refundRetryAt: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true },
    });
    for (const order of orders) {
      try {
        await this.retryRequiredFulfillmentRefund(order.id);
      } catch (e) {
        this.logger.error(
          `automatic refund retry failed for ${order.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // 微信退款回调（V3 JSON 加密报文，prod）：验签 + 解密 + refund_status=SUCCESS -> REFUNDED + 按场景回滚。
  async refundNotify(
    rawBody: string,
    headers: { timestamp?: string; nonce?: string; signature?: string },
  ): Promise<{ code: string; message: string }> {
    if (!this.wxPay.isReady()) {
      if (process.env.NODE_ENV === 'production') {
        return { code: 'FAIL', message: '微信退款回调未接入' };
      }
      return { code: 'SUCCESS', message: 'OK' };
    }
    try {
      const dec = this.wxPay.verifyAndParseRefundCallback(headers, rawBody);
      const outTradeNo = typeof dec.out_trade_no === 'string' ? dec.out_trade_no : '';
      if (!outTradeNo) return { code: 'FAIL', message: 'no out_trade_no' };
      const refundId = typeof dec.refund_id === 'string' ? dec.refund_id : undefined;
      const outRefundNo = typeof dec.out_refund_no === 'string' ? dec.out_refund_no : '';
      const order = await this.prisma.paymentOrder.findUnique({ where: { id: outTradeNo } });
      if (!order) return { code: 'SUCCESS', message: 'order not found' };
      if (dec.refund_status === 'SUCCESS') {
        await this.prisma.$transaction(async (tx) => {
          await this.lockJobPostBeforeOrderMutation(tx, order);
          const claimed = await tx.paymentOrder.updateMany({
            where: { id: outTradeNo, status: { in: [PayStatus.PAID, PayStatus.REFUNDING] } },
            data: {
              status: PayStatus.REFUNDED,
              refundedAt: new Date(),
              refundStatus: 'SUCCESS',
              ...(refundId ? { wxRefundId: refundId } : {}),
            },
          });
          if (claimed.count !== 1) return;
          if (order.fulfillmentApplied) await this.applyRefundSideEffects(order, tx);
        });
        return { code: 'SUCCESS', message: 'OK' };
      }
      const callbackStatus = dec.refund_status ?? 'ABNORMAL';
      const isAutomaticRefund = !order.fulfillmentApplied && order.refundAttempt > 0;
      if (isAutomaticRefund) {
        const expectedOutRefundNo = `${order.id}_R${Math.max(1, order.refundAttempt)}`;
        if (outRefundNo !== expectedOutRefundNo) {
          return { code: 'SUCCESS', message: 'ignored: stale refund attempt' };
        }
        await this.prisma.paymentOrder.updateMany({
          where: {
            id: outTradeNo,
            status: PayStatus.REFUNDING,
            fulfillmentApplied: false,
            refundAttempt: order.refundAttempt,
          },
          data: {
            status: PayStatus.PAID,
            refundStatus: 'REQUIRED',
            refundReason: `${order.refundReason ?? '自动退款'}；退款回调状态 ${callbackStatus}`.slice(0, 500),
            refundRetryAt: new Date(),
            ...(callbackStatus === 'CLOSED' ? { refundAttempt: { increment: 1 } } : {}),
            ...(refundId ? { wxRefundId: refundId } : {}),
          },
        });
        return { code: 'SUCCESS', message: 'OK' };
      }

      // 人工退款的 ABNORMAL/CLOSED 仅记录退款子状态，保留 REFUNDING 等待人工处理。
      await this.prisma.paymentOrder.updateMany({
        where: { id: outTradeNo, status: PayStatus.REFUNDING },
        data: { refundStatus: callbackStatus, ...(refundId ? { wxRefundId: refundId } : {}) },
      });
      return { code: 'SUCCESS', message: 'OK' };
    } catch (e) {
      return { code: 'FAIL', message: (e as Error).message };
    }
  }

  // dev 专用：手动模拟支付完成（测试用）
  async mockPay(orderId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BizException(10003, 'prod 禁止 mock 支付', HttpStatus.FORBIDDEN);
    }
    await this.fulfillOrder(orderId);
    return { orderId, status: PayStatus.PAID };
  }

  // 申请退款：V3 退款用同一套 RSA 签名，无需 V2 的 apiclient_cert.p12。
  // - 凭证缺失 + dev：mock 直接 REFUNDED + 按场景回滚（保留测试能力）。
  // - 凭证齐全：调 wxPay.refund；SUCCESS 立即 REFUNDED + 回滚；PROCESSING 置 REFUNDING 等回调；
  //   CLOSED/ABNORMAL 退款失败，订单保持 PAID（仅记 refundStatus，订单仍有效）。
  async refundOrder(callerUid: string, orderId: string, reason?: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    await this.assertOrderOwner(callerUid, order);
    // 免支付订单（平台管理员发岗）微信侧无真实支付单，退款会失败，直接拦截
    if (order.waived) {
      throw new BizException(50005, '免支付订单无需退款', HttpStatus.CONFLICT);
    }
    if (order.status === PayStatus.REFUNDED || order.status === PayStatus.REFUNDING) {
      return this.toOrderVo(order);
    }
    if (order.status !== PayStatus.PAID) {
      throw new BizException(50005, '只有已支付订单可以退款', HttpStatus.CONFLICT);
    }
    if (order.refundStatus === 'REQUIRED') {
      await this.retryRequiredFulfillmentRefund(order.id);
      const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
      if (!refreshed) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
      return this.toOrderVo(refreshed);
    }

    // dev mock（是否 mock 只看所属通道凭证）
    if (!this.isChannelReady(order)) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(
          90003,
          order.channel === PayChannel.XPAY ? '微信虚拟支付凭证未配置' : '微信支付凭证未配置',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      const refundedAt = new Date();
      const refundReason = reason ?? '申请退款';
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.lockJobPostBeforeOrderMutation(tx, order);
        const claimed = await tx.paymentOrder.updateMany({
          where: { id: orderId, status: PayStatus.PAID },
          data: { status: PayStatus.REFUNDED, refundedAt, refundReason, refundStatus: 'SUCCESS' },
        });
        if (claimed.count !== 1) {
          throw new BizException(50005, '订单状态已变更，请刷新后重试', HttpStatus.CONFLICT);
        }
        if (order.fulfillmentApplied) await this.applyRefundSideEffects(order, tx);
        return { ...order, status: PayStatus.REFUNDED, refundedAt, refundReason, refundStatus: 'SUCCESS' };
      });
      this.logger.warn(`dev mode: mock refund order ${orderId}`);
      return this.toOrderVo(updated);
    }

    // 真实退款：按通道发起（V3 同步返回最终态；XPAY 启动退款任务固定 PROCESSING，等推送/轮询收敛）
    const { refundId, status } = await this.startChannelRefund(order, `${order.id}_R1`, reason ?? '申请退款');
    if (status === 'SUCCESS') {
      const refundedAt = new Date();
      const refundReason = reason ?? '申请退款';
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.lockJobPostBeforeOrderMutation(tx, order);
        const claimed = await tx.paymentOrder.updateMany({
          where: { id: orderId, status: PayStatus.PAID },
          data: {
            status: PayStatus.REFUNDED,
            refundedAt,
            refundReason,
            refundStatus: 'SUCCESS',
            wxRefundId: refundId,
          },
        });
        if (claimed.count !== 1) {
          const current = await tx.paymentOrder.findUnique({ where: { id: orderId } });
          if (current?.status === PayStatus.REFUNDED) return current;
          throw new BizException(50005, '订单状态已变更，请刷新后重试', HttpStatus.CONFLICT);
        }
        if (order.fulfillmentApplied) await this.applyRefundSideEffects(order, tx);
        return {
          ...order,
          status: PayStatus.REFUNDED,
          refundedAt,
          refundReason,
          refundStatus: 'SUCCESS',
          wxRefundId: refundId,
        };
      });
      return this.toOrderVo(updated);
    }
    if (status === 'PROCESSING') {
      // 退款处理中：置 REFUNDING，等退款回调（refundNotify）置 REFUNDED
      const claimed = await this.prisma.paymentOrder.updateMany({
        where: { id: orderId, status: PayStatus.PAID },
        data: { status: PayStatus.REFUNDING, refundReason: reason ?? '申请退款', refundStatus: status, wxRefundId: refundId },
      });
      if (claimed.count !== 1) {
        const current = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
        if (!current) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
        return this.toOrderVo(current);
      }
      return this.toOrderVo({
        ...order,
        status: PayStatus.REFUNDING,
        refundReason: reason ?? '申请退款',
        refundStatus: status,
        wxRefundId: refundId,
      });
    }
    // CLOSED / ABNORMAL：退款失败，订单保持 PAID（仅记 refundStatus，订单仍有效可重试）
    const claimed = await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: PayStatus.PAID },
      data: { refundReason: reason ?? '申请退款', refundStatus: status, wxRefundId: refundId },
    });
    if (claimed.count !== 1) {
      const current = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
      if (!current) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
      return this.toOrderVo(current);
    }
    return this.toOrderVo({
      ...order,
      refundReason: reason ?? '申请退款',
      refundStatus: status,
      wxRefundId: refundId,
    });
  }

  // 查订单状态
  async getOrder(callerUid: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    await this.assertOrderOwner(callerUid, order);
    return this.toOrderVo(order);
  }

  // 订单状态兜底查询：用户可主动刷新，按微信真实状态对账本地（按通道分发）。
  // - V3：PENDING + SUCCESS -> 补完成；CLOSED/REVOKED/PAYERROR -> 置 CLOSED。
  // - XPAY：PENDING + 查单 status 2/3/4 -> 补完成 + 补发货；6 -> 置 CLOSED（沙箱无发货回调，全靠此兜底）。
  // - 凭证缺失：仅返回本地状态。
  async syncOrderStatus(callerUid: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new BizException(50001, '订单不存在', HttpStatus.NOT_FOUND);
    await this.assertOrderOwner(callerUid, order);

    const message =
      order.channel === PayChannel.XPAY ? await this.syncXpayOrder(order) : await this.syncV3Order(order);

    const refreshed = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    return { ...this.toOrderVo(refreshed!), message };
  }

  // V3 通道对账（boost 及存量订单）
  private async syncV3Order(order: PaymentOrder): Promise<string> {
    if (this.wxPay.isReady() && order.status === PayStatus.PAID && order.refundStatus === 'REQUIRED') {
      const refundStatus = await this.retryRequiredFulfillmentRefund(order.id);
      return refundStatus ? `自动退款状态：${refundStatus}` : '订单状态已由其他流程更新';
    }
    if (this.wxPay.isReady() && order.status === PayStatus.PENDING) {
      const { transactionId, tradeState } = await this.wxPay.queryOrder(order.id);
      if (tradeState === 'SUCCESS') {
        try {
          await this.fulfillOrder(order.id, transactionId);
          return '微信已确认支付，订单已补完成';
        } catch (e) {
          if (!(e instanceof BizException)) throw e;
          await this.recordPaidFulfillmentFailure(order.id, transactionId, e);
          return '微信已确认支付，但履约失败，订单待退款';
        }
      }
      if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(tradeState)) {
        const closed = await this.prisma.paymentOrder.updateMany({
          where: { id: order.id, status: PayStatus.PENDING },
          data: { status: PayStatus.CLOSED },
        });
        return closed.count === 1
          ? `微信订单状态 ${tradeState}，本地已置关闭`
          : '订单状态已由其他流程更新';
      }
      return `微信订单状态：${tradeState}，待支付`;
    }
    return 'dev 模式仅返回本地状态';
  }

  // XPAY 通道对账（岗位发布）：query_order status 2=已支付待发货 / 3=发货中 / 4=已发货 -> 补完成；6=已关闭。
  // 停在 2/3 时顺带 notify_provide_goods 把微信侧推到已发货（失败不阻断，仅日志）。
  private async syncXpayOrder(order: PaymentOrder): Promise<string> {
    if (!this.wxXPay.isReady()) return 'dev 模式仅返回本地状态';
    if (order.status === PayStatus.PAID && order.refundStatus === 'REQUIRED') {
      const refundStatus = await this.retryRequiredFulfillmentRefund(order.id);
      return refundStatus ? `自动退款状态：${refundStatus}` : '订单状态已由其他流程更新';
    }
    if (order.status !== PayStatus.PENDING) return '订单状态已由其他流程更新';
    const openid = await this.getXpayUserOpenid(order);
    const info = await this.wxXPay.queryOrder({ outTradeNo: order.id, openid });
    const status = typeof info.status === 'number' ? info.status : 0;
    if (status >= 2 && status <= 4) {
      const transactionId = this.str(info.wx_order_id);
      try {
        await this.fulfillOrder(order.id, transactionId);
        if (status === 2 || status === 3) {
          await this.wxXPay.notifyProvideGoods({ outTradeNo: order.id, openid }).catch(() => undefined);
        }
        return '微信已确认支付，订单已补完成';
      } catch (e) {
        if (!(e instanceof BizException)) throw e;
        await this.recordPaidFulfillmentFailure(order.id, transactionId, e);
        return '微信已确认支付，但履约失败，订单待退款';
      }
    }
    if (status === 6) {
      const closed = await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: PayStatus.PENDING },
        data: { status: PayStatus.CLOSED },
      });
      return closed.count === 1 ? '微信订单已关闭，本地已同步' : '订单状态已由其他流程更新';
    }
    return `微信订单状态 ${status}，待支付`;
  }

  // ===== XPAY 虚拟支付通道（岗位发布 + 内容推广）=====

  // 该订单所属通道的凭证是否齐备（mock 分支判定用）
  private isChannelReady(order: PaymentOrder): boolean {
    return order.channel === PayChannel.XPAY ? this.wxXPay.isReady() : this.wxPay.isReady();
  }

  private str(v: unknown): string | undefined {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  // XPAY 订单反查用户 openid（JOB_PUBLISH：order.merchantId -> merchant.userId；boost：order.userId）
  private async getXpayUserOpenid(order: PaymentOrder): Promise<string> {
    if (order.scene === PayScene.POST_BOOST || order.scene === PayScene.ANON_POST_BOOST) {
      if (!order.userId) throw new BizException(90003, '订单缺少用户信息，无法操作微信虚拟支付');
      const user = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { openid: true },
      });
      const openid = user?.openid;
      if (!openid) throw new BizException(90003, '用户 openid 缺失，无法操作微信虚拟支付');
      return openid;
    }
    if (!order.merchantId) throw new BizException(90003, '订单缺少商家信息，无法操作微信虚拟支付');
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: order.merchantId },
      select: { userId: true },
    });
    if (!merchant) throw new BizException(60002, '未入驻商家', HttpStatus.NOT_FOUND);
    const user = await this.prisma.user.findUnique({
      where: { id: merchant.userId },
      select: { openid: true },
    });
    const openid = user?.openid;
    if (!openid) throw new BizException(90003, '用户 openid 缺失，无法操作微信虚拟支付');
    return openid;
  }

  // 按通道发起退款。V3：同步返回最终态（SUCCESS/PROCESSING/CLOSED/ABNORMAL）。
  // XPAY：仅启动退款任务（left_fee 必须查单取得，不一致报 268490016），固定返回 PROCESSING，
  // 最终态靠 xpay_refund_notify 推送或 syncXpayRefundingOrders 轮询收敛。
  private async startChannelRefund(
    order: PaymentOrder,
    outRefundNo: string,
    reason: string,
  ): Promise<{ refundId: string; status: string }> {
    if (order.channel === PayChannel.XPAY) {
      const openid = await this.getXpayUserOpenid(order);
      const amountInFen = Math.round(Number(order.amount.toString()) * 100);
      const info = await this.wxXPay.queryOrder({ outTradeNo: order.id, openid });
      const leftFeeFen = typeof info.left_fee === 'number' ? info.left_fee : amountInFen;
      const { refundOrderId } = await this.wxXPay.refundOrder({
        outTradeNo: order.id,
        openid,
        leftFeeFen,
        refundFeeFen: amountInFen,
        refundOrderNo: outRefundNo.slice(0, 32),
        reasonCode: '3', // 意愿问题（用户主动退款）
        reqFrom: '3', // 其它（含自动退款）
      });
      return { refundId: refundOrderId, status: 'PROCESSING' };
    }
    const amountInFen = Math.round(Number(order.amount.toString()) * 100);
    const refundNotifyUrl = this.config.get<string>('WX_PAY_REFUND_NOTIFY_URL') ?? undefined;
    return this.wxPay.refund({
      outTradeNo: order.id,
      outRefundNo,
      reason,
      amountInFen,
      notifyUrl: refundNotifyUrl,
    });
  }

  // 退款成功落库（幂等）：PAID/REFUNDING -> REFUNDED + 按场景回滚；推送与轮询共用。
  // 幂等靠 status 声明式领取（in [PAID, REFUNDING]），重复推送第二次 count=0 直接跳过。
  private async settleRefundSuccess(order: PaymentOrder, wxRefundId?: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockJobPostBeforeOrderMutation(tx, order);
      const claimed = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: { in: [PayStatus.PAID, PayStatus.REFUNDING] } },
        data: {
          status: PayStatus.REFUNDED,
          refundedAt: new Date(),
          refundStatus: 'SUCCESS',
          ...(wxRefundId ? { wxRefundId } : {}),
        },
      });
      if (claimed.count !== 1) return false;
      if (order.fulfillmentApplied) await this.applyRefundSideEffects(order, tx);
      return true;
    });
  }

  // 消息推送：虚拟支付发货通知（xpay_goods_deliver_notify）。支付成功 -> fulfillOrder。
  // 订单不存在属永久失败，仍应答 ErrCode=0 阻止微信 15 次无意义重试。
  async xpayDeliverNotify(payload: Record<string, unknown>): Promise<{ ErrCode: number; ErrMsg?: string }> {
    const orderId = this.str(payload.OutTradeNo);
    if (!orderId) return { ErrCode: 0, ErrMsg: 'no OutTradeNo, ignored' };
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`xpay deliver notify: order ${orderId} not found, ack to stop retries`);
      return { ErrCode: 0, ErrMsg: 'order not found' };
    }
    const transactionId = this.str((payload.WeChatPayInfo as Record<string, unknown> | undefined)?.TransactionId);
    try {
      await this.fulfillOrder(orderId, transactionId);
    } catch (e) {
      if (!(e instanceof BizException)) throw e;
      // 支付成功但履约失败：走自动退款机制；应答成功避免微信重试重复触发
      await this.recordPaidFulfillmentFailure(orderId, transactionId, e);
    }
    return { ErrCode: 0, ErrMsg: 'OK' };
  }

  // 消息推送：虚拟支付退款结果（xpay_refund_notify）。RetCode=0 -> REFUNDED + 回滚；非 0 保留 REFUNDING 等轮询。
  async xpayRefundNotify(payload: Record<string, unknown>): Promise<{ ErrCode: number; ErrMsg?: string }> {
    const orderId = this.str(payload.MchOrderId);
    if (!orderId) return { ErrCode: 0, ErrMsg: 'no MchOrderId, ignored' };
    const order = await this.prisma.paymentOrder.findUnique({ where: { id: orderId } });
    if (!order) return { ErrCode: 0, ErrMsg: 'order not found' };
    const retCode = typeof payload.RetCode === 'number' ? payload.RetCode : -1;
    if (retCode !== 0) {
      this.logger.error(`xpay refund notify failed for ${orderId}: ${String(payload.RetMsg ?? retCode)}`);
      return { ErrCode: 0, ErrMsg: 'refund not successful, kept REFUNDING' };
    }
    await this.settleRefundSuccess(order, this.str(payload.WxRefundId));
    return { ErrCode: 0, ErrMsg: 'OK' };
  }

  // XPAY 退款最终态兜底轮询：沙箱不发退款回调，REFUNDING 订单定时查单收敛（5=已退款 / 8=用户退款完成）。
  // 7=退款任务失败：回退 PAID + ABNORMAL，订单仍有效可重试/人工处理。
  @Cron('30 */5 * * * *')
  async syncXpayRefundingOrders(): Promise<void> {
    if (!this.wxXPay.isReady()) return;
    const orders = await this.prisma.paymentOrder.findMany({
      where: { channel: PayChannel.XPAY, status: PayStatus.REFUNDING },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const order of orders) {
      try {
        const openid = await this.getXpayUserOpenid(order);
        const info = await this.wxXPay.queryOrder({ outTradeNo: order.id, openid });
        const status = typeof info.status === 'number' ? info.status : 0;
        if (status === 5 || status === 8) {
          await this.settleRefundSuccess(order, this.str(info.wx_order_id));
        } else if (status === 7) {
          await this.prisma.paymentOrder.updateMany({
            where: { id: order.id, status: PayStatus.REFUNDING },
            data: { status: PayStatus.PAID, refundStatus: 'ABNORMAL', refundRetryAt: new Date() },
          });
        }
      } catch (e) {
        this.logger.error(
          `xpay refund sync failed for ${order.id}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // ===== 私有辅助 =====

  // 归属校验按 scene 分支：JOB 查 merchant；boost 校验 order.userId === callerUid
  private async assertOrderOwner(callerUid: string, order: PaymentOrder): Promise<void> {
    if (order.scene === PayScene.JOB_PUBLISH) {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId: callerUid } });
      if (!merchant || merchant.status !== MerchantStatus.APPROVED || order.merchantId !== merchant.id) {
        throw new BizException(10003, '无权操作该订单', HttpStatus.FORBIDDEN);
      }
      return;
    }
    if (order.userId !== callerUid) {
      throw new BizException(10003, '无权操作该订单', HttpStatus.FORBIDDEN);
    }
  }

  private async lockJobPostBeforeOrderMutation(
    tx: Prisma.TransactionClient,
    order: PaymentOrder,
  ): Promise<void> {
    if (order.scene !== PayScene.JOB_PUBLISH || !order.jobPostId) return;
    await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"
       FROM "job_posts"
       WHERE "id" = $1
       FOR UPDATE`,
      order.jobPostId,
    );
  }

  // 退款回滚按 scene 分支：JOB 下架岗位；boost 裁剪推广（applyBoostRefund，不再置顶）
  private async applyRefundSideEffects(order: PaymentOrder, tx: Prisma.TransactionClient): Promise<void> {
    if (order.scene === PayScene.JOB_PUBLISH) {
      await tx.jobPost.updateMany({
        where: { id: order.jobPostId!, status: JobPostStatus.PUBLISHED },
        data: { status: JobPostStatus.TAKEN_DOWN },
      });
      return;
    }
    const targetType: BoostTargetType = order.scene === PayScene.POST_BOOST ? 'post' : 'anon_post';
    const targetId = targetType === 'post' ? order.postId! : order.anonPostId!;
    await this.boost.applyBoostRefund(targetType, targetId, tx);
    this.confession.invalidateFeedCache();
  }

  private async lockBoostTargetForFulfillment(
    tx: Prisma.TransactionClient,
    targetType: BoostTargetType,
    targetId: string,
  ): Promise<{ publisherScope: PublicationScope; communityId: string }> {
    if (targetType === 'post') {
      const [post] = await tx.$queryRawUnsafe<Array<{
        publisherScope: PublicationScope;
        communityId: string;
        status: PostStatus;
        visibility: PostVisibility;
        deletedAt: Date | null;
      }>>(
        `SELECT "publisher_scope" AS "publisherScope",
                "community_id" AS "communityId",
                "status",
                "visibility",
                "deleted_at" AS "deletedAt"
         FROM "posts"
         WHERE "id" = $1
         FOR UPDATE`,
        targetId,
      );
      if (!post) {
        throw new BizException(50007, '表白墙内容不存在', HttpStatus.NOT_FOUND);
      }
      if (
        post.status !== PostStatus.APPROVED
        || post.visibility !== PostVisibility.PUBLIC
        || post.deletedAt
      ) {
        throw new BizException(50007, '该内容当前不可推广', HttpStatus.CONFLICT);
      }
      return {
        publisherScope: post.publisherScope,
        communityId: post.communityId,
      };
    }

    const [anonPost] = await tx.$queryRawUnsafe<Array<{
      publisherScope: PublicationScope;
      communityId: string;
      status: PostStatus;
    }>>(
      `SELECT "publisher_scope" AS "publisherScope",
              "community_id" AS "communityId",
              "status"
       FROM "anonymous_posts"
       WHERE "id" = $1
       FOR UPDATE`,
      targetId,
    );
    if (!anonPost) {
      throw new BizException(50007, '树洞内容不存在', HttpStatus.NOT_FOUND);
    }
    if (anonPost.status !== PostStatus.APPROVED) {
      throw new BizException(50007, '该内容当前不可推广', HttpStatus.CONFLICT);
    }
    return {
      publisherScope: anonPost.publisherScope,
      communityId: anonPost.communityId,
    };
  }

  private getBoostTarget(targetType: BoostTargetType, targetId: string) {
    return targetType === 'post'
      ? this.prisma.post.findUnique({ where: { id: targetId }, select: { boostUntil: true, publisherScope: true } })
      : this.prisma.anonymousPost.findUnique({ where: { id: targetId }, select: { boostUntil: true, publisherScope: true } });
  }

  private toOrderVo(order: PaymentOrder) {
    return {
      orderId: order.id,
      scene: order.scene,
      channel: order.channel,
      jobPostId: order.jobPostId,
      duration: order.duration,
      userId: order.userId,
      postId: order.postId,
      anonPostId: order.anonPostId,
      boostPlanId: order.boostPlanId,
      amount: order.amount.toString(),
      status: order.status,
      paidAt: order.paidAt?.toISOString() ?? null,
      refundedAt: order.refundedAt?.toISOString() ?? null,
      refundReason: order.refundReason,
      wxTransactionId: order.wxTransactionId,
      wxRefundId: order.wxRefundId,
      refundStatus: order.refundStatus,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
