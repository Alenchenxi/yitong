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
import { MerchantModule } from './modules/merchant/merchant.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { PaymentModule } from './modules/payment/payment.module';
import { TreeholeModule } from './modules/treehole/treehole.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationModule } from './modules/notification/notification.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // 全局：每 IP 100 req/min（API 规范 §8）
    PrismaModule,
    WxModule,
    AuthModule,
    ModerationModule,
    UploadModule,
    ChatModule,
    MerchantModule,
    JobModule,
    PaymentModule,
    TreeholeModule,
    AdminModule,
    NotificationModule,
    ConfessionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 限流先于鉴权
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
