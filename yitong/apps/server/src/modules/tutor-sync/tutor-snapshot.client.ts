import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TutorDemandSnapshot, TutorDemandSnapshotItem } from './tutor-sync.types';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FUTURE_SKEW_MS = 10 * 60_000;
const VALID_DEMAND_STATUSES = new Set([0, 1, 2, 3]);

@Injectable()
export class TutorSnapshotClient {
  constructor(private readonly config: ConfigService) {}

  isDeploymentEnabled(): boolean {
    return this.config.get<string>('TUTOR_SYNC_ENABLED')?.toLowerCase() === 'true';
  }

  async fetchSnapshot(): Promise<TutorDemandSnapshot> {
    const url = this.config.get<string>('TUTOR_SYNC_URL')?.trim();
    const token = this.config.get<string>('TUTOR_SYNC_TOKEN')?.trim();
    if (!url || !token) {
      throw new Error('TUTOR_SYNC_URL or TUTOR_SYNC_TOKEN is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'X-Sync-Token': token },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
      return this.parseSnapshot(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  assertIntegrity(snapshot: Pick<TutorDemandSnapshot, 'itemCount' | 'items'>): void {
    if (snapshot.itemCount !== snapshot.items.length) {
      throw new Error('invalid tutor snapshot itemCount');
    }
  }

  private parseSnapshot(payload: unknown): TutorDemandSnapshot {
    if (!this.isRecord(payload) || payload.status !== 200 || !this.isRecord(payload.data)) {
      throw new Error('invalid tutor snapshot envelope');
    }
    const data = payload.data;
    if (
      data.version !== 1 ||
      data.mode !== 'full' ||
      typeof data.generatedAt !== 'string' ||
      !Array.isArray(data.items)
    ) {
      throw new Error('invalid tutor snapshot metadata');
    }
    if (data.complete !== true) throw new Error('invalid tutor snapshot completeness');
    if (
      typeof data.itemCount !== 'number' ||
      !Number.isInteger(data.itemCount) ||
      data.itemCount < 0 ||
      data.itemCount !== data.items.length
    ) {
      throw new Error('invalid tutor snapshot itemCount');
    }

    const generatedAt = new Date(data.generatedAt);
    if (!data.generatedAt.trim() || Number.isNaN(generatedAt.getTime())) {
      throw new Error('invalid tutor snapshot generatedAt');
    }
    if (generatedAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
      throw new Error('tutor snapshot generatedAt is too far in the future');
    }

    const uniqueIds = new Set<string>();
    for (let index = 0; index < data.items.length; index += 1) {
      const item = this.parseItem(data.items[index], index);
      if (uniqueIds.has(item.demandId)) {
        throw new Error('duplicate demand_id in tutor snapshot');
      }
      uniqueIds.add(item.demandId);
      data.items[index] = item;
    }
    const items = data.items as TutorDemandSnapshotItem[];

    return {
      version: 1,
      mode: 'full',
      complete: true,
      itemCount: data.itemCount,
      generatedAt,
      items,
    };
  }

  private parseItem(value: unknown, index: number): TutorDemandSnapshotItem {
    if (!this.isRecord(value)) throw new Error(`invalid tutor snapshot item at index ${index}`);
    const demandId = this.asString(value.demand_id);
    if (!demandId) throw new Error(`missing demand_id at index ${index}`);

    const status = this.asRequiredInteger(value.status, 'status', index);
    const isHide = this.asRequiredInteger(value.is_hide, 'is_hide', index);
    const isRefund = this.asRequiredInteger(value.is_refund, 'is_refund', index);
    if (!VALID_DEMAND_STATUSES.has(status)) throw new Error(`invalid status at index ${index}`);
    if (isHide !== 0 && isHide !== 1) throw new Error(`invalid is_hide at index ${index}`);
    if (isRefund !== 0 && isRefund !== 1) throw new Error(`invalid is_refund at index ${index}`);

    const createTime = this.asDate(value.create_time);
    if (createTime && createTime.getTime() > Date.now()) {
      throw new Error(`invalid create_time at index ${index}`);
    }

    return {
      demandId,
      province: this.asString(value.province),
      city: this.asString(value.city),
      area: this.asString(value.area),
      address: this.asString(value.address),
      subjectName: this.asString(value.subject_name),
      gradeName: this.asString(value.grade_name),
      overview: this.asString(value.gai_kuang),
      expense: this.asString(value.expense),
      teachTime: this.asString(value.teach_time),
      teacherGender: this.asString(value.teacher_gender),
      teacherIdentity: this.asString(value.teacher_identity),
      teacherRequire: this.asString(value.teacher_require),
      teachingWay: this.asString(value.teaching_way),
      school: this.asString(value.school),
      longitude: this.asNumber(value.longitude),
      latitude: this.asNumber(value.latitude),
      status,
      isHide,
      isRefund,
      createTime,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private asString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
  }

  private asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asRequiredInteger(value: unknown, field: string, index: number): number {
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      throw new Error(`missing ${field} at index ${index}`);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`invalid ${field} at index ${index}`);
    return parsed;
  }

  private asDate(value: unknown): Date | null {
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds <= 0) return null;
      const date = new Date(seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
}
