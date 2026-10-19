import { Global, Module } from '@nestjs/common';
import { TreeholeController } from './treehole.controller';
import { TreeholeScheduler } from './treehole.scheduler';
import { TreeholeService } from './treehole.service';
import { AnonGuard } from './anon.guard';
import { LocationService } from '../job/location.service';

@Global()
@Module({
  controllers: [TreeholeController],
  providers: [TreeholeService, AnonGuard, TreeholeScheduler, LocationService],
  exports: [TreeholeService, AnonGuard],
})
export class TreeholeModule {}
