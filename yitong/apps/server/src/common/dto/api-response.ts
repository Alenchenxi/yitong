import type { ApiResponse } from '@yitong/shared-types';

// 统一成功响应封装（与 API 设计规范 §2 对齐）
export function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, data, message };
}
