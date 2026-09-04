import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { WxModule } from './common/wx/wx.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ConfessionModule } from './modules/confession/confession.module';
import { JobModule } from './modules/job/job.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { LicenseGuard } from './license/license.guard';
import { LicenseModule } from './license/license.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { PaymentModule } from './modules/payment/payment.module';
import { CommunityModule } from './modules/community/community.module';
import { TreeholeModule } from './modules/treehole/treehole.module';
import { SquareModule } from './modules/square/square.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { BoostModule } from './modules/boost/boost.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { FollowModule } from './modules/follow/follow.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ReferralModule } from './modules/referral/referral.module';
import { SupportModule } from './modules/support/support.module';
import { UploadModule } from './modules/upload/upload.module';
import { JobCommunicationModule } from './modules/job-communication/job-communication.module';
import { TutorSyncModule } from './modules/tutor-sync/tutor-sync.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { PublicationModule } from './modules/publication/publication.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // 全局：每 IP 100 req/min（API 规范 §8）
    PrismaModule,
    AppConfigModule,
    PublicationModule,
    WxModule,
    AuthModule,
    ModerationModule,
    UploadModule,
    ChatModule,
    MerchantModule,
    JobModule,
    JobCommunicationModule,
    TutorSyncModule,
    PaymentModule,
    CommunityModule,
    TreeholeModule,
    SquareModule,
    AdminModule,
    AnnouncementModule,
    BoostModule,
    FavoriteModule,
    FollowModule,
    NotificationModule,
    ReferralModule,
    ConfessionModule,
    SupportModule,
    LicenseModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: LicenseGuard }, // 授权锁最先：未授权直接 90003，先于限流/鉴权短路
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 限流先于鉴权
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
