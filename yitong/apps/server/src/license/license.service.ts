import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { checkLicense } from './license-client';
import { computeIntegrityHash } from './integrity';
import { DEFAULT_TOLERANCE_HOURS, type LicenseStatus } from './license.constants';

interface LicenseState {
  allowed: boolean;
  status: LicenseStatus;
  expiresAt?: number;
  lastSuccessAt?: number; // 最近一次成功 /check 的时间戳；undefined=启动后还没成功过
  serverReportedTampered?: boolean; // 授权服务器告诉我们 hash 不一致
  localTampered?: boolean; // 本地 hash 与部署时锁定的 bootHash 不一致
}

/**
 * 试用授权锁服务（phone-home）。
 * 授权状态只存内存、不落盘 -> 客户端无文件可伪造；allowed 永远来自远程实时查询。
 * 断网/授权服务器不可达时保留上次态，靠容忍窗口（默认 2h）决定是否锁定，超时则 fail-closed。
 *
 * 完整性检测（防客户端改 dist/license/*.js 绕过 guard）：
 *   - 部署时构建产物 hash 写入 LICENSE_BOOT_HASH（手工或脚本算）
 *   - 运行时扫描 dist/license/*.js 算一次，与 bootHash 对比 -> localTampered
 *   - 把 computed hash 发到 /check，授权服务器与上次记录的 hash 对比 -> serverReportedTampered
 *   - 任一被篡改 -> isAllowed() 立即返回 false（不等巡检周期、不信远程响应）
 */
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly serverUrl: string;
  private readonly licenseId: string;
  private readonly apiKey: string;
  private readonly toleranceMs: number;
  private readonly bootHash: string; // 部署时锁定的 dist/license/*.js 指纹；空=不检测本地篡改
  private readonly localCheckEnabled: boolean; // 是否启用本地 hash 比对（默认 true；测试可关）
  private readonly distDir: string; // dist/ 绝对路径

  private state: LicenseState = { allowed: false, status: 'unknown' };

  constructor(config: ConfigService) {
    this.serverUrl = (config.get<string>('LICENSE_SERVER_URL') || '').trim();
    this.licenseId = (config.get<string>('LICENSE_ID') || '').trim();
    this.apiKey = (config.get<string>('LICENSE_API_KEY') || '').trim();
    const tolHours = Number(config.get<string>('LICENSE_TOLERANCE_HOURS')) || DEFAULT_TOLERANCE_HOURS;
    this.toleranceMs = Math.max(0, tolHours) * 3_600_000;
    this.bootHash = (config.get<string>('LICENSE_BOOT_HASH') || '').trim();
    this.localCheckEnabled = (config.get<string>('LICENSE_LOCAL_CHECK_ENABLED') || 'true').trim() !== 'false';
    // nest start 时 cwd 是 apps/server/，但 node dist/main.js 时是 dist/，兜底用 require.main 推断
    this.distDir = this.resolveDistDir();
  }

  private resolveDistDir(): string {
    // 始终以 cwd/dist 作为 dist 目录。开发态 nest start 时 cwd=apps/server（dist 在子目录），
    // 生产态 node dist/main.js 时 cwd=apps/server（与 dev 一致，因为 docker compose 的 working_dir）。
    // 测试可通过 LICENSE_DIST_DIR 覆盖（默认留空）。
    const override = (process.env.LICENSE_DIST_DIR || '').trim();
    if (override) return override;
    return `${process.cwd()}/dist`;
  }

  /** 是否配置了授权（未配置 = 授权功能关闭，dev 放行）。 */
  isConfigured(): boolean {
    return this.serverUrl !== '' && this.licenseId !== '' && this.apiKey !== '';
  }

  /** 当前是否放行。每请求调用，零 IO（纯内存判断）。
   *  检测到篡改（本地或授权服务器告警）立即 fail-closed，不等巡检周期。 */
  isAllowed(): boolean {
    if (!this.isConfigured()) return true; // dev：授权 OFF
    if (this.state.localTampered) return false;
    if (this.state.serverReportedTampered) return false;
    const last = this.state.lastSuccessAt;
    if (last === undefined) return false; // 启动后还没成功 check -> fail-closed
    if (Date.now() - last > this.toleranceMs) return false; // 容忍窗口超时
    return this.state.allowed;
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      allowed: this.isAllowed(),
      status: this.state.status,
      expiresAt: this.state.expiresAt,
      lastSuccessAt: this.state.lastSuccessAt,
      toleranceMs: this.toleranceMs,
      bootHash: this.bootHash,
      computedHash: this.computeAndCheckLocal(),
      localTampered: this.state.localTampered,
      serverReportedTampered: this.state.serverReportedTampered,
    };
  }

  /** 计算当前 dist/license 指纹，并与 bootHash 对比，结果写 state.localTampered。
   *  返回当前 hash（空串=无法计算，如 dev 模式）。
   *  注意：未配置 bootHash 时完全不检测本地篡改，但也不发 hash（仅看 server 端授权态）。
   *  配置了 bootHash 时，hash 始终会发到 /check（用于 server 端检测 hash 漂移），本地比对独立判断。 */
  private computeAndCheckLocal(): string {
    if (!this.bootHash) return ''; // 未配置 bootHash -> 不做本地检测，也不发 hash
    const r = computeIntegrityHash(this.distDir);
    if (r.error) this.logger.warn(`完整性扫描失败: ${r.error}`);
    if (!r.hash) {
      // dev 模式或 dist 不存在 -> 不当作篡改（生产构建后必有），仅重置为 false
      this.state.localTampered = false;
      return '';
    }
    if (this.localCheckEnabled && r.hash !== this.bootHash) {
      this.state.localTampered = true;
      this.logger.error(`🚨 检测到 dist/license/*.js 被篡改！computed=${r.hash} boot=${this.bootHash} files=${r.filesScanned}`);
    } else {
      this.state.localTampered = false;
    }
    return r.hash; // 始终返回当前 hash，让 refresh() 发到 /check 做 server 端 hash 漂移检测
  }

  /** 巡检：向授权服务器查询并更新内存态。失败时保留上次态（不清零 allowed），返回是否成功拿到响应。 */
  async refresh(): Promise<boolean> {
    if (!this.isConfigured()) return true;
    // 每次巡检都重算 hash（捕捉运行时替换文件）
    const computedHash = this.computeAndCheckLocal();
    try {
      const result = await checkLicense({
        serverUrl: this.serverUrl,
        licenseId: this.licenseId,
        apiKey: this.apiKey,
        integrityHash: computedHash || undefined,
      });
      this.state = {
        allowed: result.allowed,
        status: result.status as LicenseStatus,
        expiresAt: result.expiresAt,
        lastSuccessAt: Date.now(),
        serverReportedTampered: result.tampered === true,
        localTampered: this.state.localTampered, // 保留本地检测结果
      };
      this.logger.log(`授权巡检: status=${result.status} allowed=${result.allowed} serverTampered=${result.tampered === true} localTampered=${this.state.localTampered === true}`);
      return true;
    } catch (e) {
      this.logger.warn(`授权巡检失败（保留上次态）: ${(e as Error).message}`);
      return false;
    }
  }

  /** 启动时重试拉取授权态（最多 3 次，间隔 5s）。由 scheduler 在 onModuleInit 中 fire-and-forget 调用，不阻塞 app.listen。 */
  async refreshOnBoot(): Promise<void> {
    if (!this.isConfigured()) return;
    for (let i = 0; i < 3; i++) {
      const reached = await this.refresh();
      if (reached) return;
      await new Promise((r) => setTimeout(r, 5_000));
    }
    this.logger.warn('授权服务器 3 次重试未达，服务保持锁定直到下次巡检');
  }
}
