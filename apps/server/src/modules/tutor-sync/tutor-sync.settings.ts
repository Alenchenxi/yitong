import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const TUTOR_SYNC_MAX_DEMANDS_KEY = 'tutor_sync.max_demands';
export const TUTOR_SYNC_DEFAULT_MAX_DEMANDS = 100;
export const TUTOR_SYNC_MIN_MAX_DEMANDS = 1;
export const TUTOR_SYNC_HARD_MAX_DEMANDS = 200;

export interface TutorSyncSettings {
  maxDemands: number;
}

export function parseTutorSyncMaxDemands(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= TUTOR_SYNC_MIN_MAX_DEMANDS
    && value <= TUTOR_SYNC_HARD_MAX_DEMANDS
    ? value
    : null;
}

@Injectable()
export class TutorSyncSettingsService {
  private readonly logger = new Logger(TutorSyncSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<TutorSyncSettings> {
    try {
      const row = await this.prisma.appConfig.findUnique({
        where: { key: TUTOR_SYNC_MAX_DEMANDS_KEY },
        select: { value: true },
      });
      const configured = parseTutorSyncMaxDemands(row?.value);
      if (configured !== null) return { maxDemands: configured };
      if (row) {
        this.logger.warn(
          `invalid ${TUTOR_SYNC_MAX_DEMANDS_KEY}; using default ${TUTOR_SYNC_DEFAULT_MAX_DEMANDS}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `failed to read tutor sync settings; using default ${TUTOR_SYNC_DEFAULT_MAX_DEMANDS}: ${message}`,
      );
    }
    return { maxDemands: TUTOR_SYNC_DEFAULT_MAX_DEMANDS };
  }
}
