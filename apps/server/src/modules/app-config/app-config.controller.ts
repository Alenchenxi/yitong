import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/dto/api-response';
import { Public } from '../auth/public.decorator';
import { AppConfigService } from './app-config.service';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Get('anonymous-content')
  @Public()
  async getAnonymousContentVisibility() {
    return ok(await this.appConfig.getAnonymousContentVisibility());
  }

  @Get('job')
  @Public()
  async getJobModuleVisibility() {
    return ok(await this.appConfig.getJobModuleVisibility());
  }

  // P2-79 小程序版本更新说明（用户端更新弹窗展示；@Public 无需登录）
  @Get('mp-release-notes')
  @Public()
  async getMpReleaseNotes() {
    return ok(await this.appConfig.getMpReleaseNotes());
  }
}
