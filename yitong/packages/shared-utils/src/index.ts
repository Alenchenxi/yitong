// 跨端共享纯函数工具

export function formatPrice(yuan: number): string {
  return `¥${yuan.toFixed(2)}`;
}

export function isBlank(s: string | null | undefined): s is null | undefined {
  return s == null || s.trim().length === 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
