import type { Request } from 'express';

// JWT 载荷（与 API 设计规范 §4.1 对齐）
export interface JwtPayload {
  uid: string;
  role: string;
  openid: string;
  /** token 用途：access 用于接口访问，refresh 用于刷新；校验时区分，防止互换 */
  type?: 'access' | 'refresh';
}

// 携带已认证用户的请求类型
export type AuthenticatedRequest = Request & { user?: JwtPayload };

// 微信 code2session 返回
export interface WxSessionResult {
  openid: string;
  session_key?: string;
  unionid?: string | null;
  errcode?: number;
  errmsg?: string;
}
