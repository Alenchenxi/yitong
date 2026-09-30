import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// 计算 dist/license/*.js 的 SHA256 摘要（用于检测客户端是否手工编辑了 dist 绕过 guard）
//
// 设计取舍：
//   - 只扫描 dist/license/（授权相关代码所在的目录），不扫整个 dist（性能 + 减少误报）
//   - 用「所有文件路径+内容哈希的拼接后再哈希」得到一个固定长度指纹（避免哈希顺序不稳定）
//   - 不扫 .map（map 改不改不影响运行）
//   - 缺文件/缺目录时返回空串：表示「跑在 dev 模式（未编译）」或「客户端把 dist 整目录删了」，
//     这两种情况服务端代码本身就不在 dist 中，没必要 hash。
//
// 注意：这只防「懂 JS 但懒」的客户——真有耐心的人会同时改 hash 计算函数本身。这是猫鼠循环，
// 真正的硬防只有收回宿主权限（不让客户进容器）。本模块仅作为「篡改告警」。

const DIST_LICENSE_DIR = 'license';

export interface IntegrityHashResult {
  hash: string; // 空串表示无可计算的 dist（dev 或目录不存在）
  filesScanned: number;
  error?: string; // 扫描失败的描述（仅日志，不抛错）
}

function listLicenseJsFiles(distDir: string): string[] {
  const dir = join(distDir, DIST_LICENSE_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.js.map'))
    .sort();
}

export function computeIntegrityHash(distDir: string): IntegrityHashResult {
  const files = listLicenseJsFiles(distDir);
  if (files.length === 0) {
    return { hash: '', filesScanned: 0 };
  }
  const h = createHash('sha256');
  for (const name of files) {
    const path = join(distDir, DIST_LICENSE_DIR, name);
    let content: Buffer;
    try {
      content = readFileSync(path);
    } catch (e) {
      return { hash: '', filesScanned: 0, error: `read ${name} failed: ${(e as Error).message}` };
    }
    // 路径+长度+内容，避免仅靠文件名或仅靠内容碰撞
    h.update(name);
    h.update(String(content.length));
    h.update(content);
  }
  return { hash: h.digest('hex'), filesScanned: files.length };
}
