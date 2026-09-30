// 跨端共享类型 / 枚举（前后端共用，防止定义漂移）

// 兼职报名状态
export enum AppStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  Done = 'DONE',
  Cancelled = 'CANCELLED',
}

// 兼职岗位时长档位
export enum JobDuration {
  D30 = 'D30',
  D90 = 'D90',
}

// 兼职岗位状态
export enum JobPostStatus {
  Pending = 'PENDING',
  Published = 'PUBLISHED',
  TakenDown = 'TAKEN_DOWN',
  Expired = 'EXPIRED',
}

// 审核状态
export enum ModerationStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

// 统一响应结构（与 API 设计规范对齐）
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface ApiError {
  code: number;
  message: string;
  traceId: string;
}

// 分页
export interface Page<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
