import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { checkLicense } from './license-client';
import { DEFAULT_TOLERANCE_HOURS, type LicenseStatus } from './license.constants';

interface LicenseState {
  allowed: boolean;
  status: LicenseStatus;
  expiresAt?: number;
  lastSuccessAt?: number; // 最近一次成功 /check 的时间戳；undefined=启动后还没成功过
}

/**
 * 试用授权锁服务（phone-home）。
 * 授权状态只存内存、不落盘 -> 客户端无文件可伪造；allowed 永远来自远程实时查询。
 * 断网/授权服务器不可达时保留上次态，靠容忍窗口（默认 2h）决定是否锁定，超时则 fail-closed。
 */
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly serverUrl: string;
  private readonly licenseId: string;
  private readonly apiKey: string;
  private readonly toleranceMs: number;

  private state: LicenseState = { allowed: false, status: 'unknown' };

  constructor(config: ConfigService) {
    this.serverUrl = (config.get<string>('LICENSE_SERVER_URL') || '').trim();
    this.licenseId = (config.get<string>('LICENSE_ID') || '').trim();
    this.apiKey = (config.get<string>('LICENSE_API_KEY') || '').trim();
    const tolHours = Number(config.get<string>('LICENSE_TOLERANCE_HOURS')) || DEFAULT_TOLERANCE_HOURS;
    this.toleranceMs = Math.max(0, tolHours) * 3_600_000;
  }

  /** 是否配置了授权（未配置 = 授权功能关闭，dev 放行）。 */
  isConfigured(): boolean {
    return this.serverUrl !== '' && this.licenseId !== '' && this.apiKey !== '';
  }

  /** 当前是否放行。每请求调用，零 IO（纯内存判断）。 */
  isAllowed(): boolean {
    if (!this.isConfigured()) return true; // dev：授权 OFF
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
    };
  }

  /** 巡检：向授权服务器查询并更新内存态。失败时保留上次态（不清零 allowed），返回是否成功拿到响应。 */
  async refresh(): Promise<boolean> {
    if (!this.isConfigured()) return true;
    try {
      const result = await checkLicense({
        serverUrl: this.serverUrl,
        licenseId: this.licenseId,
        apiKey: this.apiKey,
      });
      this.state = {
        allowed: result.allowed,
        status: result.status as LicenseStatus,
        expiresAt: result.expiresAt,
        lastSuccessAt: Date.now(),
      };
      this.logger.log(`授权巡检: status=${result.status} allowed=${result.allowed}`);
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
