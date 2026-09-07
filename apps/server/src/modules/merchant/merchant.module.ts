import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
  imports: [AppConfigModule],
  controllers: [MerchantController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
