import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  JobApplyMode,
  JobCategory,
  JobDuration,
  JobPostStatus,
  JobVisibilityScope,
  Prisma,
  Settlement,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityService } from '../community/community.service';
import { TutorDemandAdapter } from './tutor-demand.adapter';
import { TutorPublisherService } from './tutor-publisher.service';
import { TutorSnapshotClient } from './tutor-snapshot.client';
import { acquireTutorSyncLock } from './tutor-sync.lock';
import {
  TUTOR_SYNC_HARD_MAX_DEMANDS,
  TutorSyncSettingsService,
} from './tutor-sync.settings';
import {
  TUTOR_SYNC_CONTACT,
  TUTOR_SYNC_PUBLISHER,
  TUTOR_SYNC_SOURCE,
  type AdaptedTutorJob,
  type TutorDemandSnapshot,
  type TutorSyncResult,
} from './tutor-sync.types';

const RECONCILE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;
const MAX_RELEVANT_BINDINGS = TUTOR_SYNC_HARD_MAX_DEMANDS * 2;

interface BoundedBinding {
  id: string;
  externalId: string;
  jobPostId: string;
  platformBlockedAt: Date | null;
  sourceActive: boolean;
  jobPost: {
    status: JobPostStatus;
  };
}

interface ExistingJobInput {
  binding: BoundedBinding;
  item: AdaptedTutorJob;
  sourceData: ReturnType<TutorSyncService['buildSourceData']>;
}

@Injectable()
export class TutorSyncService {
  private readonly logger = new Logger(TutorSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: TutorDemandAdapter,
    private readonly snapshotClient: TutorSnapshotClient,
    private readonly publisher: TutorPublisherService,
    private readonly community: CommunityService,
    private readonly settings: TutorSyncSettingsService,
  ) {}

  isEnabled(): boolean {
    return this.snapshotClient.isEnabled();
  }

  async synchronize(): Promise<TutorSyncResult> {
    const settings = await this.settings.getSettings();
    const snapshot = await this.snapshotClient.fetchSnapshot(settings.maxDemands);
    const merchantId = await this.publisher.ensurePublisher();
    const result = await this.reconcileWithLimit(
      snapshot,
      merchantId,
      settings.maxDemands,
    );
    this.logger.log(
      `tutor sync: received=${result.received} created=${result.created} updated=${result.updated} withdrawn=${result.withdrawn} skipped=${result.skipped}`,
    );
    return result;
  }

  async reconcile(
    snapshot: TutorDemandSnapshot,
    merchantId: string,
  ): Promise<TutorSyncResult> {
    const settings = await this.settings.getSettings();
    return this.reconcileWithLimit(snapshot, merchantId, settings.maxDemands);
  }

  private async reconcileWithLimit(
    snapshot: TutorDemandSnapshot,
    merchantId: string,
    maxDemands: number,
  ): Promise<TutorSyncResult> {
    this.snapshotClient.assertCapacity(snapshot, maxDemands);
    const adapted = snapshot.items.map((item) => this.adapter.adapt(item));
    const externalIds = adapted.map((item) => item.externalId);
    if (new Set(externalIds).size !== externalIds.length) {
      throw new Error('duplicate demand_id in tutor snapshot');
    }

    return this.prisma.$transaction(async (tx) => {
      await acquireTutorSyncLock(tx);
      const state = await tx.tutorSyncState.findUnique({
        where: { source: TUTOR_SYNC_SOURCE },
        select: { lastGeneratedAt: true },
      });
      if (
        state?.lastGeneratedAt
        && snapshot.generatedAt.getTime() <= state.lastGeneratedAt.getTime()
      ) {
        return this.emptyResult(adapted.length, true);
      }

      const snapshotBindingCondition = externalIds.length > 0
        ? Prisma.sql`OR binding."external_id" IN (${Prisma.join(externalIds)})`
        : Prisma.empty;
      const bindings = await tx.$queryRaw<BoundedBinding[]>(Prisma.sql`
        SELECT
          binding."id" AS "id",
          binding."external_id" AS "externalId",
          binding."job_post_id" AS "jobPostId",
          binding."platform_blocked_at" AS "platformBlockedAt",
          binding."source_active" AS "sourceActive",
          jsonb_build_object('status', post."status") AS "jobPost"
        FROM "tutor_job_sync_bindings" AS binding
        INNER JOIN "job_posts" AS post ON post."id" = binding."job_post_id"
        WHERE binding."source" = ${TUTOR_SYNC_SOURCE}
          AND (
            binding."source_active" = TRUE
            ${snapshotBindingCondition}
          )
        LIMIT ${MAX_RELEVANT_BINDINGS + 1}
      `);
      if (bindings.length > MAX_RELEVANT_BINDINGS) {
        throw new Error(
          `tutor sync relevant bindings exceed hard limit of ${MAX_RELEVANT_BINDINGS}`,
        );
      }

      const bindingByExternalId = new Map(
        bindings.map((binding) => [binding.externalId, binding]),
      );
      const itemByExternalId = new Map(
        adapted.map((item) => [item.externalId, item]),
      );
      const existingInputs: ExistingJobInput[] = [];
      const newActiveItems: AdaptedTutorJob[] = [];

      for (const item of adapted) {
        const binding = bindingByExternalId.get(item.externalId);
        if (binding) {
          existingInputs.push({
            binding,
            item,
            sourceData: this.buildSourceData(item, merchantId),
          });
        } else if (item.active) {
          newActiveItems.push(item);
        }
      }
      const missingBindings = bindings.filter(
        (binding) => !itemByExternalId.has(binding.externalId),
      );

      const counters = this.emptyResult(adapted.length, false);
      counters.created = newActiveItems.length;
      counters.updated = existingInputs.filter(({ item }) => item.active).length;
      counters.withdrawn = existingInputs.filter(
        ({ item, binding }) =>
          !item.active && binding.jobPost.status !== JobPostStatus.TAKEN_DOWN,
      ).length + missingBindings.filter(
        (binding) => binding.jobPost.status !== JobPostStatus.TAKEN_DOWN,
      ).length;

      await this.updateExistingJobPosts(tx, existingInputs);
      await this.withdrawMissingJobPosts(tx, missingBindings);
      await this.updateBindingActivity(tx, bindings, itemByExternalId);
      await this.createNewJobPosts(tx, merchantId, newActiveItems);

      await tx.tutorSyncState.upsert({
        where: { source: TUTOR_SYNC_SOURCE },
        update: { lastGeneratedAt: snapshot.generatedAt },
        create: {
          source: TUTOR_SYNC_SOURCE,
          lastGeneratedAt: snapshot.generatedAt,
        },
      });
      return counters;
    }, RECONCILE_TRANSACTION_OPTIONS);
  }

  private async updateExistingJobPosts(
    tx: Prisma.TransactionClient,
    inputs: ExistingJobInput[],
  ): Promise<void> {
    if (inputs.length === 0) return;
    const rows = inputs.map(({ binding, item, sourceData }) => ({
      jobPostId: binding.jobPostId,
      merchantId: sourceData.merchantId,
      communityId: sourceData.communityId,
      createdAt: item.createdAt?.toISOString() ?? null,
      title: sourceData.title,
      description: sourceData.description,
      requirements: sourceData.requirements,
      contactPhone: sourceData.contactPhoneSnapshot,
      contactWechat: sourceData.contactWechatSnapshot,
      salary: sourceData.salary,
      salaryAmount: sourceData.salaryAmount,
      location: sourceData.location,
      locationLng: sourceData.locationLng,
      locationLat: sourceData.locationLat,
      locationCity: sourceData.locationCity,
      active: item.active,
      blocked: binding.platformBlockedAt !== null,
    }));

    await tx.$executeRaw(Prisma.sql`
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS value(
          "jobPostId" text,
          "merchantId" text,
          "communityId" text,
          "createdAt" timestamptz,
          "title" text,
          "description" text,
          "requirements" text,
          "contactPhone" text,
          "contactWechat" text,
          "salary" text,
          "salaryAmount" integer,
          "location" text,
          "locationLng" numeric,
          "locationLat" numeric,
          "locationCity" text,
          "active" boolean,
          "blocked" boolean
        )
      )
      UPDATE "job_posts" AS post
      SET
        "merchant_id" = input."merchantId",
        "community_id" = input."communityId",
        "created_at" = COALESCE(input."createdAt", post."created_at"),
        "title" = input."title",
        "description" = input."description",
        "requirements" = input."requirements",
        "contact_phone_snapshot" = input."contactPhone",
        "contact_wechat_snapshot" = input."contactWechat",
        "salary" = input."salary",
        "salary_amount" = input."salaryAmount",
        "location" = input."location",
        "location_poi_id" = NULL,
        "location_lng" = input."locationLng",
        "location_lat" = input."locationLat",
        "location_city" = input."locationCity",
        "category" = CAST(${JobCategory.TUTORING} AS "JobCategory"),
        "custom_category" = NULL,
        "settlement" = CAST(${Settlement.COMPLETION} AS "Settlement"),
        "work_dates" = ARRAY[]::text[],
        "work_periods" = ARRAY[]::text[],
        "headcount" = 1,
        "urgent" = FALSE,
        "online" = FALSE,
        "questions" = ARRAY[]::text[],
        "duration" = CAST(${JobDuration.D90} AS "JobDuration"),
        "expire_at" = NULL,
        "visibility_scope" = CAST(
          ${JobVisibilityScope.ALL_COMMUNITIES} AS "JobVisibilityScope"
        ),
        "apply_mode" = CAST(${JobApplyMode.CONTACT_ONLY} AS "JobApplyMode"),
        "publisher_name" = ${TUTOR_SYNC_PUBLISHER},
        "status" = CASE
          WHEN input."active" AND NOT input."blocked"
            THEN CAST(${JobPostStatus.PUBLISHED} AS "JobPostStatus")
          ELSE CAST(${JobPostStatus.TAKEN_DOWN} AS "JobPostStatus")
        END,
        "taken_down_at" = CASE
          WHEN input."active" AND NOT input."blocked" THEN NULL
          ELSE COALESCE(post."taken_down_at", CURRENT_TIMESTAMP)
        END,
        "deleted_at" = CASE
          WHEN input."active" AND NOT input."blocked" THEN NULL
          ELSE post."deleted_at"
        END
      FROM input
      WHERE post."id" = input."jobPostId"
    `);
  }

  private async withdrawMissingJobPosts(
    tx: Prisma.TransactionClient,
    bindings: BoundedBinding[],
  ): Promise<void> {
    if (bindings.length === 0) return;
    const rows = bindings.map((binding) => ({ jobPostId: binding.jobPostId }));
    await tx.$executeRaw(Prisma.sql`
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          AS value("jobPostId" text)
      )
      UPDATE "job_posts" AS post
      SET
        "status" = CAST(${JobPostStatus.TAKEN_DOWN} AS "JobPostStatus"),
        "taken_down_at" = COALESCE(post."taken_down_at", CURRENT_TIMESTAMP)
      FROM input
      WHERE post."id" = input."jobPostId"
        AND post."status" <> CAST(${JobPostStatus.TAKEN_DOWN} AS "JobPostStatus")
    `);
  }

  private async updateBindingActivity(
    tx: Prisma.TransactionClient,
    bindings: BoundedBinding[],
    itemByExternalId: Map<string, AdaptedTutorJob>,
  ): Promise<void> {
    if (bindings.length === 0) return;
    const rows = bindings.map((binding) => ({
      id: binding.id,
      sourceActive: itemByExternalId.get(binding.externalId)?.active ?? false,
    }));
    await tx.$executeRaw(Prisma.sql`
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          AS value("id" text, "sourceActive" boolean)
      )
      UPDATE "tutor_job_sync_bindings" AS binding
      SET
        "source_active" = input."sourceActive",
        "updated_at" = CURRENT_TIMESTAMP
      FROM input
      WHERE binding."id" = input."id"
    `);
  }

  private async createNewJobPosts(
    tx: Prisma.TransactionClient,
    merchantId: string,
    items: AdaptedTutorJob[],
  ): Promise<void> {
    if (items.length === 0) return;
    const rows = items.map((item) => ({
      id: randomUUID(),
      externalId: item.externalId,
      sourceData: this.buildSourceData(item, merchantId),
    }));
    await tx.jobPost.createMany({
      data: rows.map(({ id, sourceData }) => ({
        id,
        ...sourceData,
        featured: false,
        featuredAt: null,
        status: JobPostStatus.PUBLISHED,
        takenDownAt: null,
        deletedAt: null,
      })),
    });
    const bindingRows = rows.map(({ id: jobPostId, externalId }) => ({
        id: randomUUID(),
        source: TUTOR_SYNC_SOURCE,
        externalId,
        jobPostId,
        sourceActive: true,
      }));
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "tutor_job_sync_bindings" (
        "id",
        "source",
        "external_id",
        "job_post_id",
        "source_active",
        "created_at",
        "updated_at"
      )
      SELECT
        input."id",
        input."source",
        input."externalId",
        input."jobPostId",
        input."sourceActive",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM jsonb_to_recordset(${JSON.stringify(bindingRows)}::jsonb) AS input(
        "id" text,
        "source" text,
        "externalId" text,
        "jobPostId" text,
        "sourceActive" boolean
      )
    `);
  }

  private buildSourceData(item: AdaptedTutorJob, merchantId: string) {
    return {
      merchantId,
      communityId: this.community.defaultCommunityId,
      ...(item.createdAt ? { createdAt: item.createdAt } : {}),
      title: item.title,
      description: item.description,
      requirements: item.requirements,
      contactPhoneSnapshot: TUTOR_SYNC_CONTACT,
      contactWechatSnapshot: TUTOR_SYNC_CONTACT,
      salary: item.salary,
      salaryAmount: item.salaryAmount,
      location: item.location,
      locationPoiId: null,
      locationLng: item.locationLng,
      locationLat: item.locationLat,
      locationCity: item.locationCity,
      category: JobCategory.TUTORING,
      customCategory: null,
      settlement: Settlement.COMPLETION,
      workDates: [],
      workPeriods: [],
      headcount: 1,
      urgent: false,
      online: false,
      questions: [],
      duration: JobDuration.D90,
      expireAt: null,
      visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
      applyMode: JobApplyMode.CONTACT_ONLY,
      publisherName: TUTOR_SYNC_PUBLISHER,
    };
  }

  private emptyResult(received: number, skipped: boolean): TutorSyncResult {
    return {
      received,
      created: 0,
      updated: 0,
      withdrawn: 0,
      skipped,
    };
  }
}
