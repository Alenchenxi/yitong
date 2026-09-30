import { HttpStatus } from '@nestjs/common';

// 业务错误码：服务停用（沿用项目 90003「服务阻断」段，与 payment/upload/wx 等一致）
export const LICENSE_DISABLED_CODE = 90003;
export const LICENSE_DISABLED_STATUS = HttpStatus.SERVICE_UNAVAILABLE;
export const LICENSE_DISABLED_MSG = '服务已停用，请联系提供商';

// 默认值
export const DEFAULT_TRIAL_DAYS = 10;
export const DEFAULT_TOLERANCE_HOURS = 2;

// LicenseGuard 白名单装饰器元数据 key
export const LICENSE_PUBLIC_KEY = 'licensePublic';

// 授权状态（与授权服务器 KV 中的 status 字段对齐；unknown=未巡检到）
export type LicenseStatus = 'inactive' | 'trial' | 'active' | 'locked' | 'unknown';
