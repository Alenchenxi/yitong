import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/dto/api-response';
import { BoostService } from './boost.service';

// 内容推广档位：全局 JwtAuthGuard 保护（boost 页需登录），无用户态信息需求
@Controller('boost')
export class BoostController {
  constructor(private readonly boost: BoostService) {}

  // 推广档位列表（1天/3天/7天），价格由后台配置
  @Get('plans')
  async plans() {
    return ok(await this.boost.listPlans());
  }
}
