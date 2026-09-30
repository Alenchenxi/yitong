import { Controller, Get, Post } from '@nestjs/common';
import { ok } from '../common/dto/api-response';
import { Public } from '../modules/auth/public.decorator';
import { LicensePublic } from './license-public.decorator';
import { LicenseService } from './license.service';

// 只读/运维端点（@Public + @LicensePublic：锁定时也可达）
//  - GET  /license/status  : 小程序遇 90003 后查停用详情
//  - POST /license/refresh : CLI 改完远程状态后立即同步本地态（避免等下轮 cron）
// 注意：activate/unlock/lock 不暴露 HTTP（防爆破），仅走 docker exec CLI。
@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  @Public()
  @LicensePublic()
  @Get('status')
  status() {
    return ok(this.license.getStatus());
  }

  @Public()
  @LicensePublic()
  @Post('refresh')
  async refresh() {
    await this.license.refresh();
    return ok(this.license.getStatus());
  }
}
