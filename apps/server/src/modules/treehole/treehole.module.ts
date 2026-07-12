import { Global, Module } from '@nestjs/common';
import { TreeholeController } from './treehole.controller';
import { TreeholeService } from './treehole.service';
import { AnonGuard } from './anon.guard';

@Global()
@Module({
  controllers: [TreeholeController],
  providers: [TreeholeService, AnonGuard],
  exports: [TreeholeService],
})
export class TreeholeModule {}
