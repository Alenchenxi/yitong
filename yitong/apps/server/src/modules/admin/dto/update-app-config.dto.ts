// P2-26 全局配置 KV 更新 DTO
// key 走 URL param @Param('key')，value 走 body
// value 用 unknown，由服务端白名单校验 + prisma Json 写入
// 必须加 @IsDefined()，否则全局 ValidationPipe (whitelist: true, forbidNonWhitelisted: true)
// 会把无装饰器字段当"非白名单"剥除
import { IsDefined } from 'class-validator';

export class UpdateAppConfigDto {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @IsDefined()
  value!: unknown;
}
