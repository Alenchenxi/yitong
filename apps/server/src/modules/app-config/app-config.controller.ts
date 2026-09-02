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
}
