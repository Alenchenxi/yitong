// Prisma enum 字符串常量集中(避免冒烟测试重复 import @prisma/client)
export const PAY_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDING: 'REFUNDING',
  REFUNDED: 'REFUNDED',
  CLOSED: 'CLOSED',
} as const;

export const JOB_POST_STATUS = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  TAKEN_DOWN: 'TAKEN_DOWN',
  EXPIRED: 'EXPIRED',
} as const;
