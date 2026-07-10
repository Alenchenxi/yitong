import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    WxModule,
    AuthModule,
    ModerationModule,
    UploadModule,
    ChatModule,
    MerchantModule,
    JobModule,
    PaymentModule,
    ConfessionModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
