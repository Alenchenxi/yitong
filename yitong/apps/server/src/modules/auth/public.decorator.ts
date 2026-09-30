import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// 标记接口为公开（免鉴权），用于 auth/wx-login、auth/refresh 等白名单
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
