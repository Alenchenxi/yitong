import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // 业务模块在各自 Phase 接入：
    // AuthModule / ConfessionModule / TreeholeModule / JobModule / PaymentModule /
    // ChatModule / ModerationModule / MerchantModule / AdminModule / SyncModule
  ],
})
export class AppModule {}
