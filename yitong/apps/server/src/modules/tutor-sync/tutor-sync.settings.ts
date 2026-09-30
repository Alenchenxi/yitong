import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Persisted for compatibility; this value now controls per-batch size, not snapshot total. */
export const TUTOR_SYNC_BATCH_SIZE_KEY = 'tutor_sync.max_demands';
export const TUTOR_SYNC_ENABLED_KEY = 'tutor_sync.enabled';
export const TUTOR_SYNC_DEFAULT_ENABLED = false;
export const TUTOR_SYNC_DEFAULT_BATCH_SIZE = 100;
export const TUTOR_SYNC_MIN_BATCH_SIZE = 1;
export const TUTOR_SYNC_MAX_BATCH_SIZE = 200;

export interface TutorSyncSettings {
  enabled: boolean;
  batchSize: number;
}

export function parseTutorSyncEnabled(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function parseTutorSyncBatchSize(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= TUTOR_SYNC_MIN_BATCH_SIZE &&
    value <= TUTOR_SYNC_MAX_BATCH_SIZE
    ? value
    : null;
}

@Injectable()
export class TutorSyncSettingsService {
  private readonly logger = new Logger(TutorSyncSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<TutorSyncSettings> {
    try {
      const rows = await this.prisma.appConfig.findMany({
        where: {
          key: { in: [TUTOR_SYNC_ENABLED_KEY, TUTOR_SYNC_BATCH_SIZE_KEY] },
        },
        select: { key: true, value: true },
      });
      const valueByKey = new Map(rows.map((row) => [row.key, row.value]));
      const configuredEnabled = parseTutorSyncEnabled(valueByKey.get(TUTOR_SYNC_ENABLED_KEY));
      const configuredBatchSize = parseTutorSyncBatchSize(
        valueByKey.get(TUTOR_SYNC_BATCH_SIZE_KEY),
      );
      if (valueByKey.has(TUTOR_SYNC_ENABLED_KEY) && configuredEnabled === null) {
        this.logger.warn(
          `invalid ${TUTOR_SYNC_ENABLED_KEY}; using default ${TUTOR_SYNC_DEFAULT_ENABLED}`,
        );
      }
      if (valueByKey.has(TUTOR_SYNC_BATCH_SIZE_KEY) && configuredBatchSize === null) {
        this.logger.warn(
          `invalid ${TUTOR_SYNC_BATCH_SIZE_KEY}; using default ${TUTOR_SYNC_DEFAULT_BATCH_SIZE}`,
        );
      }
      return {
        enabled: configuredEnabled ?? TUTOR_SYNC_DEFAULT_ENABLED,
        batchSize: configuredBatchSize ?? TUTOR_SYNC_DEFAULT_BATCH_SIZE,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`failed to read tutor sync settings; using safe defaults: ${message}`);
    }
    return {
      enabled: TUTOR_SYNC_DEFAULT_ENABLED,
      batchSize: TUTOR_SYNC_DEFAULT_BATCH_SIZE,
    };
  }
}
