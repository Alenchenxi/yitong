import { SetMetadata } from '@nestjs/common';
import { LICENSE_PUBLIC_KEY } from './license.constants';

// 标记路由跳过 LicenseGuard（如 GET /license/status、POST /license/refresh）
// 服务锁定时这些端点仍可达，供小程序查状态 / CLI 触发刷新
export const LicensePublic = () => SetMetadata(LICENSE_PUBLIC_KEY, true);
