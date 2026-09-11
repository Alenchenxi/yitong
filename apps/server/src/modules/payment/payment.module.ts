import { Module } from '@nestjs/common';
import { BoostModule } from '../boost/boost.module';
import { ConfessionModule } from '../confession/confession.module';
import { PaymentController } from './payment.controller';
import { WxPushController } from './wx-push.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [BoostModule, ConfessionModule],
  controllers: [PaymentController, WxPushController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
