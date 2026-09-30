import { Module } from '@nestjs/common';
import { TreeholeModule } from '../treehole/treehole.module';
import { NearbyController, TreeholeNearbyController } from './nearby.controller';
import { NearbyService } from './nearby.service';

@Module({
  imports: [TreeholeModule],
  controllers: [NearbyController, TreeholeNearbyController],
  providers: [NearbyService],

})
export class NearbyModule {}
