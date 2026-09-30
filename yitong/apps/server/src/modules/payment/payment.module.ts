import { Module } from '@nestjs/common';
import { BoostModule } from '../boost/boost.module';
import { ConfessionModule } from '../confession/confession.module';
import { PaymentController } from './payment.controller';
import { WxPushController } from './wx-push.controller';
import { PaymentService } from './payment.service';
import { XpayPropSyncService } from './xpay-prop-sync.service';

@Module({
  imports: [BoostModule, ConfessionModule],
  controllers: [PaymentController, WxPushController],
  providers: [PaymentService, XpayPropSyncService],
  exports: [PaymentService, XpayPropSyncService],
})
export class PaymentModule {}
