import { Global, Module } from '@nestjs/common';
import { TreeholeController } from './treehole.controller';
import { TreeholeScheduler } from './treehole.scheduler';
import { TreeholeService } from './treehole.service';
import { AnonGuard } from './anon.guard';

@Global()
@Module({
  controllers: [TreeholeController],
  providers: [TreeholeService, AnonGuard, TreeholeScheduler],
  exports: [TreeholeService],
})
export class TreeholeModule {}
