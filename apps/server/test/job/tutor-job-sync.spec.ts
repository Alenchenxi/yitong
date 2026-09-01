/**
 * 家教需求同步回归测试：全部使用 mock，不连接数据库，不产生测试数据。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import {
  CommunityStatus,
  JobApplyMode,
  JobCategory,
  JobDuration,
  JobPostStatus,
  JobVisibilityScope,
  Settlement,
} from '@prisma/client';
import { AdminService } from '../../src/modules/admin/admin.service';
import { JobVisibilityPolicyService } from '../../src/modules/job-visibility/job-visibility.service';
import { JobService } from '../../src/modules/job/job.service';
import { TutorDemandAdapter } from '../../src/modules/tutor-sync/tutor-demand.adapter';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';
import { TutorSnapshotClient } from '../../src/modules/tutor-sync/tutor-snapshot.client';
import { acquireTutorSyncLock } from '../../src/modules/tutor-sync/tutor-sync.lock';
import { TutorSyncScheduler } from '../../src/modules/tutor-sync/tutor-sync.scheduler';
import {
  TUTOR_SYNC_DEFAULT_ENABLED,
  TUTOR_SYNC_DEFAULT_BATCH_SIZE,
  TUTOR_SYNC_ENABLED_KEY,
  TUTOR_SYNC_MAX_BATCH_SIZE,
  TUTOR_SYNC_BATCH_SIZE_KEY,
  TutorSyncSettingsService,
} from '../../src/modules/tutor-sync/tutor-sync.settings';
import { TutorSyncService } from '../../src/modules/tutor-sync/tutor-sync.service';
import {
  TUTOR_SYNC_CONTACT,
  TUTOR_SYNC_CONTACT_INSTRUCTION,
  TUTOR_SYNC_PUBLISHER,
  type TutorDemandSnapshot,
  type TutorDemandSnapshotItem,
} from '../../src/modules/tutor-sync/tutor-sync.types';

function buildSourceItem(
  overrides: Partial<TutorDemandSnapshotItem> = {},
): TutorDemandSnapshotItem {
  return {
    demandId: '101',
    province: '浙江省',
    city: '杭州市',
    area: '西湖区',
    address: '文三路',
    subjectName: '数学',
    gradeName: '初中',
    overview: '每周辅导两次',
    expense: '200元/次',
    teachTime: '周末下午',
    teacherGender: '不限',
    teacherIdentity: '在校大学生',
    teacherRequire: '有耐心',
    teachingWay: '上门授课',
    school: '附近中学',
    longitude: 120.12,
    latitude: 30.28,
    status: 1,
    isHide: 0,
    isRefund: 0,
    createTime: new Date('2026-08-20T08:00:00.000Z'),
    ...overrides,
  };
}

function buildSnapshot(
  items: TutorDemandSnapshotItem[],
  generatedAt = new Date('2026-08-28T10:00:00+08:00'),
): TutorDemandSnapshot {
  return {
    version: 1,
    mode: 'full',
    complete: true,
    itemCount: items.length,
    generatedAt,
    items,
  };
}

function buildRawSourceItem(overrides: Record<string, unknown> = {}) {
  return {
    demand_id: '101',
    status: 1,
    is_hide: 0,
    is_refund: 0,
    province: '浙江省',
    city: '杭州市',
    subject_name: '数学',
    grade_name: '初中',
    create_time: '2026-08-20T08:00:00.000Z',
    ...overrides,
  };
}

interface BindingFixture {
  id?: string;
  externalId: string;
  jobPostId: string;
  platformBlockedAt?: Date | null;
  sourceActive?: boolean;
  status?: JobPostStatus;
}

function buildSyncService(
  options: {
    bindings?: BindingFixture[];
    state?: { lastGeneratedAt: Date | null } | null;
    enabled?: boolean;
    deploymentEnabled?: boolean;
    batchSize?: number;
    settingsError?: Error;
  } = {},
) {
  const bindings = (options.bindings ?? []).map((binding, index) => ({
    id: binding.id ?? `binding_${index + 1}`,
    externalId: binding.externalId,
    jobPostId: binding.jobPostId,
    platformBlockedAt: binding.platformBlockedAt ?? null,
    sourceActive: binding.sourceActive ?? true,
    jobPost: { status: binding.status ?? JobPostStatus.PUBLISHED },
  }));
  const batchSize = options.batchSize ?? TUTOR_SYNC_DEFAULT_BATCH_SIZE;
  const queryRaw = jest.fn(
    async (query: { strings?: readonly string[]; values?: readonly unknown[] }) => {
      const sql = query.strings?.join('?') ?? '';
      const values = query.values ?? [];
      if (sql.includes('binding."source_active" = TRUE')) {
        const hasCursor = sql.includes('binding."id" > ?');
        const afterId = hasCursor ? values.at(-2) : null;
        const requestedBatchSize = values.at(-1);
        const activeBindings = bindings
          .filter(
            (binding) =>
              binding.sourceActive &&
              (typeof afterId !== 'string' || binding.id.localeCompare(afterId) > 0),
          )
          .sort((left, right) => left.id.localeCompare(right.id));
        return activeBindings.slice(
          0,
          typeof requestedBatchSize === 'number' ? requestedBatchSize : batchSize,
        );
      }
      if (sql.includes('binding."external_id" IN')) {
        const requested = new Set(
          values.filter((value): value is string => typeof value === 'string'),
        );
        return bindings.filter((binding) => requested.has(binding.externalId));
      }
      return [];
    },
  );
  const tx = {
    $queryRaw: queryRaw,
    $executeRaw: jest.fn().mockResolvedValue(0),
    tutorSyncState: {
      findUnique: jest.fn().mockResolvedValue(options.state ?? null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    jobPost: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      (callback: (client: typeof tx) => unknown, _options?: { maxWait: number; timeout: number }) =>
        callback(tx),
    ),
  };
  const settings = {
    getSettings: options.settingsError
      ? jest.fn().mockRejectedValue(options.settingsError)
      : jest.fn().mockResolvedValue({
          enabled: options.enabled ?? true,
          batchSize,
        }),
  };
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          TUTOR_SYNC_ENABLED: String(options.deploymentEnabled ?? true),
          TUTOR_SYNC_URL: 'https://tutor.example/internal/sync/tutor-demands',
          TUTOR_SYNC_TOKEN: 'test-token',
        })[key],
    ),
  };
  const snapshotClient = new TutorSnapshotClient(config as never);
  const service = new TutorSyncService(
    prisma as never,
    new TutorDemandAdapter(),
    snapshotClient,
    { ensurePublisher: jest.fn().mockResolvedValue('merchant_a') } as never,
    { defaultCommunityId: 'cm_default' } as never,
    settings as never,
  );
  return { service, prisma, tx, settings, snapshotClient };
}

function sqlText(call: unknown[] | undefined): string {
  const query = call?.[0] as readonly string[] | { strings?: readonly string[] } | undefined;
  if (Array.isArray(query)) return query.join('?');
  return (query as { strings?: readonly string[] } | undefined)?.strings?.join('?') ?? '';
}

function sqlJsonRows(call: unknown[] | undefined): Array<Record<string, unknown>> {
  const query = call?.[0] as { values?: unknown[] } | readonly string[] | undefined;
  const values =
    !query || Array.isArray(query) ? [] : ((query as { values?: unknown[] }).values ?? []);
  const json = values.find(
    (value): value is string => typeof value === 'string' && value.startsWith('['),
  );
  return json ? (JSON.parse(json) as Array<Record<string, unknown>>) : [];
}

describe('TutorSync PostgreSQL advisory lock', () => {
  it('阻塞事务锁使用executeRaw避免Prisma反序列化void列', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error("Failed to deserialize column of type 'void'")),
    };

    await expect(acquireTutorSyncLock(tx as never)).resolves.toBeUndefined();

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(tx.$executeRaw.mock.calls[0])).toContain('pg_advisory_xact_lock');
  });
});

describe('TutorSyncScheduler failure logging', () => {
  it('Error日志首行包含类型和trim后的message并保留stack', async () => {
    const error = new Error('\nInvalid prisma query');
    error.stack = 'STACK';
    const tutorSync = {
      isDeploymentEnabled: jest.fn().mockReturnValue(true),
      synchronize: jest.fn().mockRejectedValue(error),
    };
    const scheduler = new TutorSyncScheduler(tutorSync as never);
    const logger = (
      scheduler as unknown as {
        logger: { error: (message: string, stack?: string) => void };
      }
    ).logger;
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation();

    await expect(scheduler.synchronizeTutorDemands()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      'tutor sync failed: Error: Invalid prisma query',
      'STACK',
    );
    await scheduler.synchronizeTutorDemands();
    expect(tutorSync.synchronize).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new Error('   '), 'tutor sync failed: Error: unknown error', expect.any(String)],
    ['plain failure', 'tutor sync failed: plain failure', undefined],
  ])('兼容空Error消息和非Error异常', async (reason, message, stack) => {
    const tutorSync = {
      isDeploymentEnabled: jest.fn().mockReturnValue(true),
      synchronize: jest.fn().mockRejectedValue(reason),
    };
    const scheduler = new TutorSyncScheduler(tutorSync as never);
    const logger = (
      scheduler as unknown as {
        logger: { error: (message: string, stack?: string) => void };
      }
    ).logger;
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation();

    await scheduler.synchronizeTutorDemands();

    expect(errorSpy).toHaveBeenCalledWith(message, stack);
  });
});

function buildOpsSettingsComponent() {
  const source = readFileSync(
    resolve(__dirname, '../../../user-miniprogram/components/admin-panels/ops/index.ts'),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const getAppSettings = jest.fn();
  const updateAppSetting = jest.fn();
  const adminModule = new Proxy(
    { getAppSettings, updateAppSetting },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return jest.fn();
      },
    },
  );
  type OpsDefinition = {
    data: Record<string, unknown>;
    methods: Record<string, (...args: never[]) => unknown>;
  };
  const holder: { current: OpsDefinition | null } = { current: null };
  runInNewContext(compiled, {
    module: { exports: {} },
    exports: {},
    require(specifier: string) {
      if (specifier === '../../../services/admin') return adminModule;
      if (specifier === '../../../services/upload') return { uploadImage: jest.fn() };
      if (specifier === '../../../services/announcement')
        return new Proxy(
          {},
          {
            get: () => jest.fn(),
          },
        );
      throw new Error(`unexpected module: ${specifier}`);
    },
    Component(definition: OpsDefinition) {
      holder.current = definition;
    },
    getApp: () => ({ requireAuth: () => true }),
    wx: {
      showToast: jest.fn(),
      stopPullDownRefresh: jest.fn(),
    },
    console,
  });
  if (!holder.current) throw new Error('ops component was not registered');
  const definition = holder.current;
  const data = structuredClone(definition.data);
  const component = {
    data,
    setData(updates: Record<string, unknown>) {
      Object.assign(data, updates);
    },
    ...definition.methods,
  } as unknown as {
    data: Record<string, unknown>;
    setData(updates: Record<string, unknown>): void;
    load(): Promise<void>;
    toggleTutorSync(event: { detail: { value: boolean } }): Promise<void>;
    saveTutorSyncSettings(): Promise<void>;
  };
  component.data.sub = 'settings';
  return { component, getAppSettings, updateAppSetting };
}

describe('TutorDemandAdapter', () => {
  it('将家教需求映射为燚桐兼职字段', () => {
    expect(new TutorDemandAdapter().adapt(buildSourceItem())).toEqual({
      externalId: '101',
      active: true,
      title: '初中数学家教',
      description: [
        '需求概况：每周辅导两次',
        '授课时间：周末下午',
        '授课方式：上门授课',
        '学校：附近中学',
      ].join('\n'),
      requirements: ['性别要求：不限', '身份要求：在校大学生', '其他要求：有耐心'].join('\n'),
      salary: '200元/次',
      salaryAmount: 200,
      location: '浙江省 杭州市 西湖区 文三路',
      locationLng: 120.12,
      locationLat: 30.28,
      locationCity: '杭州市',
      createdAt: new Date('2026-08-20T08:00:00.000Z'),
    });
  });

  it('将源平台数值字段转换为岗位详情中文释义', () => {
    const adapter = new TutorDemandAdapter();
    expect(
      adapter.adapt(
        buildSourceItem({
          teachTime: '0',
          teachingWay: '1',
          teacherGender: '0',
          teacherIdentity: '1',
        }),
      ),
    ).toMatchObject({
      description: [
        '需求概况：每周辅导两次',
        '授课时间：待协商',
        '授课方式：上门授课',
        '学校：附近中学',
      ].join('\n'),
      requirements: ['性别要求：不限', '身份要求：大学生教员', '其他要求：有耐心'].join(
        '\n',
      ),
    });
    expect(
      adapter.adapt(
        buildSourceItem({
          teachingWay: '2',
          teacherGender: '2',
          teacherIdentity: '2',
        }),
      ),
    ).toMatchObject({
      description: expect.stringContaining('授课方式：在线授课'),
      requirements: expect.stringContaining('性别要求：女\n身份要求：专职教员'),
    });
    expect(
      adapter.adapt(
        buildSourceItem({
          teachingWay: '3',
          teacherGender: '3',
          teacherIdentity: '3',
        }),
      ),
    ).toMatchObject({
      description: expect.stringContaining('授课方式：均可'),
      requirements: expect.stringContaining('性别要求：不限\n身份要求：不限'),
    });
    expect(
      adapter.adapt(
        buildSourceItem({
          teachingWay: '0',
          teacherGender: '1',
          teacherIdentity: '0',
        }),
      ),
    ).toMatchObject({
      description: expect.stringContaining('授课方式：均可'),
      requirements: expect.stringContaining('性别要求：男\n身份要求：不限'),
    });
    expect(
      adapter.adapt(
        buildSourceItem({
          teachTime: ' 周末晚上 ',
          teachingWay: ' 线下或线上 ',
          teacherGender: ' 另行沟通 ',
          teacherIdentity: ' 有经验者 ',
        }),
      ),
    ).toMatchObject({
      description: expect.stringContaining('授课时间：周末晚上\n授课方式：线下或线上'),
      requirements: expect.stringContaining('性别要求：另行沟通\n身份要求：有经验者'),
    });
    expect(
      adapter.adapt(
        buildSourceItem({
          teachTime: '1788244200',
        }),
      ),
    ).toMatchObject({
      description: expect.stringContaining('授课时间：2026-09-01 14:30:00'),
    });
  });

  it('空字段兜底且关闭、隐藏、退款均标记为非启用', () => {
    const adapter = new TutorDemandAdapter();
    expect(
      adapter.adapt(
        buildSourceItem({
          subjectName: '',
          gradeName: '',
          overview: '',
          expense: '',
          address: '',
          longitude: 999,
          latitude: -999,
          isHide: 1,
        }),
      ),
    ).toMatchObject({
      active: false,
      title: '家教兼职',
      salary: '薪资面议',
      locationLng: null,
      locationLat: null,
    });
    expect(adapter.adapt(buildSourceItem({ status: 2 })).active).toBe(false);
    expect(adapter.adapt(buildSourceItem({ isRefund: 1 })).active).toBe(false);
  });
});

describe('TutorSyncSettingsService', () => {
  it('读取 AppConfig 中的运行开关和每批同步数量', async () => {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockResolvedValue([
          { key: TUTOR_SYNC_ENABLED_KEY, value: true },
          { key: TUTOR_SYNC_BATCH_SIZE_KEY, value: 150 },
        ]),
      },
    };
    await expect(new TutorSyncSettingsService(prisma as never).getSettings()).resolves.toEqual({
      enabled: true,
      batchSize: 150,
    });
  });

  it.each([undefined, null, 1, 'true'])('运行开关缺失或非法时默认关闭: %p', async (value) => {
    const prisma = {
      appConfig: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            ...(value === undefined ? [] : [{ key: TUTOR_SYNC_ENABLED_KEY, value }]),
            { key: TUTOR_SYNC_BATCH_SIZE_KEY, value: 120 },
          ]),
      },
    };
    await expect(new TutorSyncSettingsService(prisma as never).getSettings()).resolves.toEqual({
      enabled: TUTOR_SYNC_DEFAULT_ENABLED,
      batchSize: 120,
    });
  });

  it.each([undefined, 0, 201, 1.5, '100'])(
    '批次配置缺失或非法时仍使用默认100: %p',
    async (value) => {
      const prisma = {
        appConfig: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { key: TUTOR_SYNC_ENABLED_KEY, value: true },
              ...(value === undefined ? [] : [{ key: TUTOR_SYNC_BATCH_SIZE_KEY, value }]),
            ]),
        },
      };
      await expect(new TutorSyncSettingsService(prisma as never).getSettings()).resolves.toEqual({
        enabled: true,
        batchSize: 100,
      });
    },
  );

  it('读取失败时安全降级为代码默认值', async () => {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockRejectedValue(new Error('db unavailable')),
      },
    };
    await expect(new TutorSyncSettingsService(prisma as never).getSettings()).resolves.toEqual({
      enabled: false,
      batchSize: 100,
    });
  });
});

describe('TutorSyncService 双重开关', () => {
  it('部署总开关关闭时不读取管理配置且不请求源接口', async () => {
    const { service, settings, snapshotClient, prisma } = buildSyncService({
      deploymentEnabled: false,
    });
    const fetchSnapshot = jest.spyOn(snapshotClient, 'fetchSnapshot');

    await expect(service.synchronize()).resolves.toMatchObject({ skipped: true });
    expect(settings.getSettings).not.toHaveBeenCalled();
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('管理端运行开关关闭时不请求源接口', async () => {
    const { service, settings, snapshotClient, prisma } = buildSyncService({
      deploymentEnabled: true,
      enabled: false,
    });
    const fetchSnapshot = jest.spyOn(snapshotClient, 'fetchSnapshot');

    await expect(service.synchronize()).resolves.toMatchObject({ skipped: true });
    expect(settings.getSettings).toHaveBeenCalledTimes(1);
    expect(fetchSnapshot).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('部署总开关与管理端运行开关同时开启时执行同步', async () => {
    const { service, snapshotClient, prisma, tx } = buildSyncService({
      deploymentEnabled: true,
      enabled: true,
    });
    const fetchSnapshot = jest
      .spyOn(snapshotClient, 'fetchSnapshot')
      .mockResolvedValue(buildSnapshot([]));

    await expect(service.synchronize()).resolves.toMatchObject({
      received: 0,
      skipped: false,
    });
    expect(fetchSnapshot).toHaveBeenCalledWith();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.tutorSyncState.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('AdminService 系统同步配置', () => {
  function buildAdmin(
    rows: Array<{
      key: string;
      value: unknown;
      updatedAt: Date;
      updatedBy: string | null;
    }> = [],
  ) {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockResolvedValue(rows),
        upsert: jest.fn().mockImplementation(async (args) => args.create),
      },
    };
    return {
      service: new AdminService(prisma as never, {} as never, {} as never, {} as never),
      prisma,
    };
  }

  it('读取接口补齐默认关闭和默认100且不返回任何部署秘密', async () => {
    const { service } = buildAdmin();
    const settings = await service.getSettings();
    expect(settings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: TUTOR_SYNC_BATCH_SIZE_KEY,
          value: TUTOR_SYNC_DEFAULT_BATCH_SIZE,
        }),
        expect.objectContaining({
          key: TUTOR_SYNC_ENABLED_KEY,
          value: TUTOR_SYNC_DEFAULT_ENABLED,
        }),
      ]),
    );
    expect(settings.map((item) => item.key)).not.toEqual(
      expect.arrayContaining(['TUTOR_SYNC_TOKEN', 'TUTOR_SYNC_URL']),
    );
  });

  it('读取接口将数据库中的非法批次大小降级为默认100', async () => {
    const { service } = buildAdmin([
      {
        key: TUTOR_SYNC_BATCH_SIZE_KEY,
        value: 5000,
        updatedAt: new Date('2026-08-29T08:00:00.000Z'),
        updatedBy: 'legacy-admin',
      },
    ]);
    await expect(service.getSettings()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: TUTOR_SYNC_BATCH_SIZE_KEY,
          value: TUTOR_SYNC_DEFAULT_BATCH_SIZE,
        }),
      ]),
    );
  });

  it.each([1, 100, TUTOR_SYNC_MAX_BATCH_SIZE])('允许管理员写入范围内整数 %i', async (value) => {
    const { service, prisma } = buildAdmin();
    await service.updateSetting(TUTOR_SYNC_BATCH_SIZE_KEY, value, 'admin-openid');
    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value, updatedBy: 'admin-openid' }),
      }),
    );
  });

  it.each([true, false])('允许管理员将运行开关写为 %p', async (value) => {
    const { service, prisma } = buildAdmin();
    await service.updateSetting(TUTOR_SYNC_ENABLED_KEY, value, 'admin-openid');
    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value, updatedBy: 'admin-openid' }),
      }),
    );
  });

  it.each(['true', 1, null, undefined])('拒绝非法运行开关 %p', async (value) => {
    const { service, prisma } = buildAdmin();
    await expect(
      service.updateSetting(TUTOR_SYNC_ENABLED_KEY, value, 'admin-openid'),
    ).rejects.toMatchObject({ bizCode: 40003, status: 400 });
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });

  it.each([0, 201, 1.5, '100', null])('拒绝非法批次大小 %p', async (value) => {
    const { service, prisma } = buildAdmin();
    await expect(
      service.updateSetting(TUTOR_SYNC_BATCH_SIZE_KEY, value, 'admin-openid'),
    ).rejects.toMatchObject({ bizCode: 40003, status: 400 });
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });
});

describe('AdminService 家教岗位举报处置', () => {
  function buildReportAdmin(
    options: {
      tutorBinding?: boolean;
      reporterId?: string | null;
    } = {},
  ) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ acquired: true }]),
      tutorJobSyncBinding: {
        findUnique: jest.fn().mockResolvedValue(options.tutorBinding ? { id: 'binding_a' } : null),
        updateMany: jest.fn().mockResolvedValue({ count: options.tutorBinding ? 1 : 0 }),
      },
      jobPost: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ merchant: null }),
      },
      moderationRecord: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      moderationRecord: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'report_a',
          targetType: 'job_post',
          targetId: 'post_a',
          status: 'PENDING',
          reporterId: options.reporterId ?? null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      jobPost: {
        findUnique: jest.fn().mockResolvedValue({ merchant: null }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const notification = { create: jest.fn().mockResolvedValue({}) };
    const policy = new TutorJobPolicyService();
    const policySpy = jest.spyOn(policy, 'takeDownJobPostWithGuard');
    const service = new AdminService(prisma as never, {} as never, notification as never, policy);
    return { service, prisma, tx, notification, policySpy };
  }

  it('举报成立但未勾选下架时仅结案且同步岗位零下架副作用', async () => {
    const { service, prisma, tx, notification, policySpy } = buildReportAdmin({
      tutorBinding: true,
    });

    await expect(
      service.resolveReport('report_a', 'admin_a', {
        action: 'approve',
        takedown: false,
      }),
    ).resolves.toMatchObject({ id: 'report_a', status: 'APPROVED' });

    expect(prisma.moderationRecord.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(policySpy).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.jobPost.updateMany).not.toHaveBeenCalled();
    expect(tx.tutorJobSyncBinding.updateMany).not.toHaveBeenCalled();
    expect(notification.create).not.toHaveBeenCalled();
  });

  it('明确勾选下架时同步岗位写入永久封禁', async () => {
    const { service, prisma, tx, policySpy } = buildReportAdmin({ tutorBinding: true });

    await service.resolveReport('report_a', 'admin_a', {
      action: 'approve',
      takedown: true,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(policySpy).toHaveBeenCalledWith(tx, 'post_a', expect.any(Date), {
      requireTutorBinding: false,
      publishedOnly: true,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.jobPost.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.tutorJobSyncBinding.updateMany).toHaveBeenCalledWith({
      where: { jobPostId: 'post_a' },
      data: { platformBlockedAt: expect.any(Date) },
    });
  });

  it('明确勾选下架时普通岗位下架但不写同步封禁或争抢同步锁', async () => {
    const { service, tx } = buildReportAdmin({ tutorBinding: false });

    await service.resolveReport('report_a', 'admin_a', {
      action: 'approve',
      takedown: true,
    });

    expect(tx.jobPost.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.tutorJobSyncBinding.updateMany).not.toHaveBeenCalled();
  });

  it('管理员直接下架同步岗位时继续写入永久封禁', async () => {
    const { service, prisma, tx, policySpy } = buildReportAdmin({ tutorBinding: true });

    await service.takedownJobPost('post_a', 'admin_a', '人工下架');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(policySpy).toHaveBeenCalledWith(tx, 'post_a', expect.any(Date), {
      requireTutorBinding: false,
      publishedOnly: false,
    });
    expect(tx.tutorJobSyncBinding.updateMany).toHaveBeenCalledWith({
      where: { jobPostId: 'post_a' },
      data: { platformBlockedAt: expect.any(Date) },
    });
    expect(tx.moderationRecord.create).toHaveBeenCalledTimes(1);
  });
});

describe('TutorSnapshotClient 全量快照完整性', () => {
  const client = new TutorSnapshotClient({ get: jest.fn() } as never);

  afterEach(() => jest.restoreAllMocks());

  it('全量快照超过原100/200条上限时仍允许进入分批处理', () => {
    expect(() =>
      client.assertIntegrity({
        itemCount: 1_000,
        items: Array.from({ length: 1_000 }) as never,
      }),
    ).not.toThrow();
  });

  it('itemCount与items长度不一致时失败关闭', () => {
    expect(() =>
      client.assertIntegrity({
        itemCount: 2,
        items: [{}] as never,
      }),
    ).toThrow('invalid tutor snapshot itemCount');
  });

  it('fetchSnapshot复用源items数组并原位替换为规范化对象', async () => {
    const rawItems = [buildRawSourceItem()];
    const originalItem = rawItems[0];
    const fetchClient = new TutorSnapshotClient({
      get: jest.fn(
        (key: string) =>
          ({
            TUTOR_SYNC_URL: 'https://tutor.example/internal/sync/tutor-demands',
            TUTOR_SYNC_TOKEN: 'test-token',
          })[key],
      ),
    } as never);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          version: 1,
          mode: 'full',
          complete: true,
          itemCount: rawItems.length,
          generatedAt: '2026-08-29T10:00:00.000Z',
          items: rawItems,
        },
      }),
    } as never);

    const snapshot = await fetchClient.fetchSnapshot();

    expect(snapshot.items).toBe(rawItems);
    expect(snapshot.items[0]).not.toBe(originalItem);
    expect(snapshot.items[0]).toEqual(
      expect.objectContaining({
        demandId: '101',
        status: 1,
        isHide: 0,
        isRefund: 0,
      }),
    );
  });

  it('fetchSnapshot原位解析时仍拒绝重复demand_id', async () => {
    const rawItems = [buildRawSourceItem(), buildRawSourceItem({ city: '宁波市' })];
    const fetchClient = new TutorSnapshotClient({
      get: jest.fn(
        (key: string) =>
          ({
            TUTOR_SYNC_URL: 'https://tutor.example/internal/sync/tutor-demands',
            TUTOR_SYNC_TOKEN: 'test-token',
          })[key],
      ),
    } as never);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 200,
        data: {
          version: 1,
          mode: 'full',
          complete: true,
          itemCount: rawItems.length,
          generatedAt: '2026-08-29T10:00:00.000Z',
          items: rawItems,
        },
      }),
    } as never);

    await expect(fetchClient.fetchSnapshot()).rejects.toThrow(
      'duplicate demand_id in tutor snapshot',
    );
  });
});

describe('TutorSyncService 全量快照分批对账', () => {
  it('首次同步批量创建全圈、长期有效、仅联系岗位', async () => {
    const { service, prisma, tx } = buildSyncService();
    await expect(
      service.reconcile(buildSnapshot([buildSourceItem()]), 'merchant_a'),
    ).resolves.toEqual({
      received: 1,
      created: 1,
      updated: 0,
      withdrawn: 0,
      skipped: false,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0]?.[1]).toEqual({
      maxWait: 10_000,
      timeout: 120_000,
    });
    expect(tx.jobPost.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          merchantId: 'merchant_a',
          contactPhoneSnapshot: TUTOR_SYNC_CONTACT,
          contactWechatSnapshot: TUTOR_SYNC_CONTACT,
          category: JobCategory.TUTORING,
          settlement: Settlement.COMPLETION,
          duration: JobDuration.D90,
          expireAt: null,
          visibilityScope: JobVisibilityScope.ALL_COMMUNITIES,
          applyMode: JobApplyMode.CONTACT_ONLY,
          publisherName: TUTOR_SYNC_PUBLISHER,
          status: JobPostStatus.PUBLISHED,
        }),
      ],
    });
    const bindingInsertCall = tx.$executeRaw.mock.calls.find((call) =>
      sqlText(call).includes('INSERT INTO "tutor_job_sync_bindings"'),
    );
    expect(sqlText(bindingInsertCall)).toContain('INSERT INTO "tutor_job_sync_bindings"');
  });

  it('已存在需求使用一条参数化SQL批量覆盖源字段', async () => {
    const { service, tx } = buildSyncService({
      bindings: [{ externalId: '101', jobPostId: 'post_existing' }],
    });
    await expect(
      service.reconcile(
        buildSnapshot([buildSourceItem({ overview: '源平台已修改' })]),
        'merchant_a',
      ),
    ).resolves.toMatchObject({ created: 0, updated: 1, withdrawn: 0 });

    expect(tx.jobPost.createMany).not.toHaveBeenCalled();
    const updateCall = tx.$executeRaw.mock.calls.find((call) =>
      sqlText(call).includes('UPDATE "job_posts"'),
    );
    expect(sqlText(updateCall)).toContain('jsonb_to_recordset');
    expect(sqlJsonRows(updateCall)).toEqual([
      expect.objectContaining({
        jobPostId: 'post_existing',
        description: expect.stringContaining('源平台已修改'),
        active: true,
        blocked: false,
      }),
    ]);
  });

  it('关闭与快照缺失需求批量下架并标记sourceActive=false', async () => {
    const { service, tx } = buildSyncService({
      bindings: [
        { externalId: '101', jobPostId: 'post_closed' },
        { externalId: '102', jobPostId: 'post_deleted' },
      ],
    });
    await expect(
      service.reconcile(buildSnapshot([buildSourceItem({ status: 2 })]), 'merchant_a'),
    ).resolves.toMatchObject({ withdrawn: 2 });

    const withdrawCall = tx.$executeRaw.mock.calls.find((call) =>
      sqlText(call).includes('post."status" <>'),
    );
    expect(sqlText(withdrawCall)).toContain('UPDATE "job_posts"');
    expect(sqlText(withdrawCall)).toContain('CURRENT_TIMESTAMP');
    const activityRows = tx.$executeRaw.mock.calls
      .filter((call) => sqlText(call).includes('UPDATE "tutor_job_sync_bindings"'))
      .flatMap(sqlJsonRows);
    expect(activityRows).toEqual([
      expect.objectContaining({ id: 'binding_1', sourceActive: false }),
      expect.objectContaining({ id: 'binding_2', sourceActive: false }),
    ]);
  });

  it('平台永久下架的需求只更新源字段且保持下架', async () => {
    const { service, tx } = buildSyncService({
      bindings: [
        {
          externalId: '101',
          jobPostId: 'post_blocked',
          platformBlockedAt: new Date('2026-08-28T03:00:00.000Z'),
          status: JobPostStatus.TAKEN_DOWN,
        },
      ],
    });
    await service.reconcile(buildSnapshot([buildSourceItem()]), 'merchant_a');
    const updateCall = tx.$executeRaw.mock.calls.find((call) =>
      sqlText(call).includes('UPDATE "job_posts"'),
    );
    expect(sqlJsonRows(updateCall)).toEqual([
      expect.objectContaining({ blocked: true, active: true }),
    ]);
    expect(sqlText(updateCall)).toContain('WHEN input."active" AND NOT input."blocked"');
  });

  it('旧快照在锁内跳过且不读取binding或写岗位', async () => {
    const generatedAt = new Date('2026-08-28T02:00:00.000Z');
    const { service, tx } = buildSyncService({
      state: { lastGeneratedAt: generatedAt },
    });
    await expect(
      service.reconcile(buildSnapshot([buildSourceItem()], generatedAt), 'merchant_a'),
    ).resolves.toMatchObject({ skipped: true });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(tx.$executeRaw.mock.calls[0])).toContain('pg_advisory_xact_lock');
    expect(tx.tutorSyncState.upsert).not.toHaveBeenCalled();
  });

  it('对账失败时事务不会推进快照状态', async () => {
    const { service, tx } = buildSyncService({
      bindings: [{ externalId: '101', jobPostId: 'post_existing' }],
    });
    tx.$executeRaw.mockResolvedValueOnce(0).mockRejectedValueOnce(new Error('write failed'));
    await expect(
      service.reconcile(buildSnapshot([buildSourceItem()]), 'merchant_a'),
    ).rejects.toThrow('write failed');
    expect(tx.tutorSyncState.upsert).not.toHaveBeenCalled();
  });

  it('后续创建批次失败时尚未执行缺失下架且不推进快照状态', async () => {
    const { service, tx } = buildSyncService({
      bindings: [{ externalId: '999', jobPostId: 'post_missing' }],
      batchSize: 1,
    });
    tx.jobPost.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error('create batch failed'));

    await expect(
      service.reconcile(
        buildSnapshot([buildSourceItem({ demandId: '101' }), buildSourceItem({ demandId: '102' })]),
        'merchant_a',
      ),
    ).rejects.toThrow('create batch failed');
    expect(tx.jobPost.createMany).toHaveBeenCalledTimes(2);
    expect(
      tx.$executeRaw.mock.calls.some((call) =>
        sqlText(call).includes('UPDATE "job_posts" AS post'),
      ),
    ).toBe(false);
    expect(
      tx.$queryRaw.mock.calls.some((call) =>
        sqlText(call).includes('binding."source_active" = TRUE'),
      ),
    ).toBe(false);
    expect(tx.tutorSyncState.upsert).not.toHaveBeenCalled();
  });
  it('当前ID分批查询不截断，历史活跃binding使用有序LIMIT分页', async () => {
    const { service, tx } = buildSyncService();
    await service.reconcile(buildSnapshot([buildSourceItem()]), 'merchant_a');
    const currentBatchQuery = tx.$queryRaw.mock.calls.find((call) =>
      sqlText(call).includes('binding."external_id" IN'),
    );
    const activeQuery = tx.$queryRaw.mock.calls.find((call) =>
      sqlText(call).includes('binding."source_active" = TRUE'),
    );
    expect(sqlText(activeQuery)).toContain('binding."source_active" = TRUE');
    expect(sqlText(currentBatchQuery)).toContain('binding."external_id" IN');
    expect(sqlText(currentBatchQuery)).not.toContain('LIMIT');
    expect(sqlText(activeQuery)).toContain('ORDER BY binding."id" ASC LIMIT');
  });

  it('历史活跃binding超过单批数量时按稳定游标分批下架', async () => {
    const bindings = Array.from({ length: 5 }, (_, index) => ({
      id: `binding_${index + 1}`,
      externalId: String(index + 1),
      jobPostId: `post_${index + 1}`,
    }));
    const { service, tx } = buildSyncService({ bindings, batchSize: 2 });

    await expect(service.reconcile(buildSnapshot([]), 'merchant_a')).resolves.toMatchObject({
      withdrawn: 5,
    });

    const activeQueries = tx.$queryRaw.mock.calls.filter((call) =>
      sqlText(call).includes('binding."source_active" = TRUE'),
    );
    expect(activeQueries).toHaveLength(3);
    expect(activeQueries.map(sqlText)).toEqual([
      expect.stringContaining('ORDER BY binding."id" ASC LIMIT'),
      expect.stringContaining('AND binding."id" > ?'),
      expect.stringContaining('AND binding."id" > ?'),
    ]);
    const activityRows = tx.$executeRaw.mock.calls
      .filter((call) => sqlText(call).includes('UPDATE "tutor_job_sync_bindings"'))
      .flatMap(sqlJsonRows);
    expect(activityRows).toHaveLength(5);
  });

  it('200条既有需求按每批50条执行更新和活跃标记', async () => {
    const items = Array.from({ length: 200 }, (_, index) =>
      buildSourceItem({
        demandId: String(index + 1),
      }),
    );
    const bindings = items.map((item, index) => ({
      externalId: item.demandId,
      jobPostId: `post_${index + 1}`,
    }));
    const { service, tx } = buildSyncService({ bindings, batchSize: 50 });
    await expect(service.reconcile(buildSnapshot(items), 'merchant_a')).resolves.toMatchObject({
      updated: 200,
    });
    const writeCalls = tx.$executeRaw.mock.calls.filter(
      (call) => !sqlText(call).includes('pg_advisory_xact_lock'),
    );
    expect(writeCalls).toHaveLength(8);
    expect(tx.jobPost.createMany).not.toHaveBeenCalled();
  });

  it('201条首次同步按100、100、1三批创建且总量不截断', async () => {
    const items = Array.from({ length: 201 }, (_, index) =>
      buildSourceItem({
        demandId: String(index + 1),
      }),
    );
    const { service, prisma, tx } = buildSyncService({ batchSize: 100 });
    await expect(service.reconcile(buildSnapshot(items), 'merchant_a')).resolves.toMatchObject({
      received: 201,
      created: 201,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.jobPost.createMany).toHaveBeenCalledTimes(3);
    expect(tx.jobPost.createMany.mock.calls.map((call) => call[0].data.length)).toEqual([
      100, 100, 1,
    ]);
  });

  it('不调用内容审核且源字段直接进入批量SQL', async () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/modules/tutor-sync/tutor-sync.service.ts'),
      'utf8',
    );
    expect(source).not.toContain('ModerationService');
    expect(source).not.toContain('checkText');
    expect(source).not.toContain('contentReviewHash');
    expect(source).not.toContain('processingToken');
  });
});

function buildNearestJobService() {
  const prisma = {
    merchant: { findUnique: jest.fn() },
    jobPost: { findMany: jest.fn().mockResolvedValue([]) },
    jobApplication: { groupBy: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const location = {
    convertGcj02ToBd09: jest.fn(async (lng: number, lat: number) => ({ lng, lat })),
    normalizeAdministrativeName: jest.fn((value: string) => value),
  };
  const community = {
    resolveFeedCommunityId: jest.fn().mockResolvedValue('community_a'),
  };
  const service = new JobService(
    prisma as never,
    { checkText: jest.fn() } as never,
    {} as never,
    location as never,
    community as never,
    new JobVisibilityPolicyService(),
    { isExternalTutorPost: jest.fn().mockReturnValue(false) } as never,
  );
  return { service, prisma, location, community };
}

describe('JobService nearest索引预筛选', () => {
  it('常见近距离页面单次SQL即返回并包含经纬度bounding box', async () => {
    const { service, prisma } = buildNearestJobService();
    prisma.$queryRaw.mockResolvedValueOnce(
      Array.from({ length: 21 }, (_, index) => ({
        id: `post_${index}`,
        distance: index / 10,
      })),
    );
    await service.listPosts('student_a', {
      sort: 'nearest',
      userLng: 120,
      userLat: 30,
      limit: 20,
    } as never);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = prisma.$queryRaw.mock.calls[0];
    expect(sqlText(query)).toContain('"location_lat" BETWEEN');
    expect(sqlText(query)).toContain('"location_lng" BETWEEN');
    expect(sqlText(query)).toContain(`"jp"."status" = 'PUBLISHED'::"JobPostStatus"`);
  });

  it('候选不足时逐级扩张且最终全球范围不截断远端岗位', async () => {
    const { service, prisma } = buildNearestJobService();
    prisma.$queryRaw.mockResolvedValue([]);
    await service.listPosts('student_a', {
      sort: 'nearest',
      userLng: 120,
      userLat: 30,
      limit: 20,
    } as never);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(7);
    const finalQuery = prisma.$queryRaw.mock.calls.at(-1);
    expect(sqlText(finalQuery)).toContain('"location_lat" BETWEEN -90 AND 90');
    expect(sqlText(finalQuery)).toContain('"location_lng" BETWEEN -180 AND 180');
  });

  it('跨日期变更线时生成两段经度范围', async () => {
    const { service, prisma } = buildNearestJobService();
    prisma.$queryRaw.mockResolvedValueOnce(
      Array.from({ length: 21 }, (_, index) => ({
        id: `post_${index}`,
        distance: index / 10,
      })),
    );
    await service.listPosts('student_a', {
      sort: 'nearest',
      userLng: 179.99,
      userLat: 0,
      limit: 20,
    } as never);
    const query = prisma.$queryRaw.mock.calls[0];
    expect(sqlText(query)).toContain('"location_lng" BETWEEN ? AND 180');
    expect(sqlText(query)).toContain('OR "jp"."location_lng" BETWEEN -180 AND ?');
  });

  it('接近极点时不使用会漏岗的经度限制', async () => {
    const { service, prisma } = buildNearestJobService();
    prisma.$queryRaw.mockResolvedValueOnce(
      Array.from({ length: 21 }, (_, index) => ({
        id: `post_${index}`,
        distance: index / 10,
      })),
    );
    await service.listPosts('student_a', {
      sort: 'nearest',
      userLng: 30,
      userLat: 89.99,
      limit: 20,
    } as never);
    expect(sqlText(prisma.$queryRaw.mock.calls[0])).not.toContain('"location_lng" BETWEEN');
  });

  it('同距离分页继续使用distance与id稳定keyset', async () => {
    const { service, prisma } = buildNearestJobService();
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'post_a', distance: 1 },
      { id: 'post_b', distance: 1 },
      { id: 'post_c', distance: 1 },
    ]);
    const first = await service.listPosts('student_a', {
      sort: 'nearest',
      userLng: 120,
      userLat: 30,
      limit: 2,
    } as never);
    expect(first.nextCursor).toEqual(expect.stringMatching(/^nearest:v1:/));

    prisma.$queryRaw.mockClear();
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await service.listPosts('student_a', {
      sort: 'nearest',
      userLng: 120,
      userLat: 30,
      limit: 2,
      cursor: first.nextCursor,
    } as never);
    expect(sqlText(prisma.$queryRaw.mock.calls[0])).toContain('"distance" > ?');
    expect(sqlText(prisma.$queryRaw.mock.calls[0])).toContain('"distance" = ? AND "id" > ?');
  });
});

describe('数据库与部署静态契约', () => {
  const migrationPath = resolve(
    __dirname,
    '../../prisma/migrations/20260828103000_tutor_job_sync/migration.sql',
  );
  const activeCursorMigrationPath = resolve(
    __dirname,
    '../../prisma/migrations/20260830023000_tutor_sync_active_cursor_index/migration.sql',
  );

  it('binding迁移包含活跃状态与有界查询索引', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('"source_active" BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('tutor_job_sync_bindings_source_source_active_idx');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "tutor_job_sync_bindings_source_external_id_key"',
    );
  });

  it('历史活跃binding游标迁移包含source、source_active和id复合索引', () => {
    const migration = readFileSync(activeCursorMigrationPath, 'utf8');
    const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
    expect(migration).toContain('tutor_job_sync_bindings_source_source_active_id_idx');
    expect(migration).toContain('ON "tutor_job_sync_bindings"("source", "source_active", "id")');
    expect(schema).toContain('@@index([source, sourceActive, id])');
  });

  it('nearest迁移包含两个可部署的部分B-tree索引', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('job_posts_nearest_location_lat_idx');
    expect(migration).toContain('job_posts_nearest_location_lng_idx');
    expect(migration).toContain('WHERE "status" = \'PUBLISHED\'');
  });

  it('schema与迁移不再包含审核哈希和claim租约字段', () => {
    const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
    expect(schema).not.toMatch(
      /contentReviewHash|processingSnapshotTime|processingToken|leaseExpiresAt/,
    );
    expect(schema).toContain('sourceActive');
  });

  it('环境变量模板只保留启用开关、URL和Token', () => {
    for (const file of [
      resolve(__dirname, '../../../../.env.example'),
      resolve(__dirname, '../../.env.example'),
      resolve(__dirname, '../../../../.env.production.example'),
    ]) {
      const env = readFileSync(file, 'utf8');
      expect(env).toContain('TUTOR_SYNC_ENABLED=');
      expect(env).toContain('TUTOR_SYNC_URL=');
      expect(env).toContain('TUTOR_SYNC_TOKEN=');
      expect(env).not.toMatch(
        /TUTOR_SYNC_(?:MODERATION_OPENID|LEASE_SECONDS|LEASE_RENEW_SECONDS|MAX_DEMANDS)/,
      );
    }
  });

  it('管理配置API受AdminGuard保护', () => {
    const controller = readFileSync(
      resolve(__dirname, '../../src/modules/admin/admin.controller.ts'),
      'utf8',
    );
    expect(controller).toContain('@UseGuards(AdminGuard)');
    expect(controller).toContain("@Get('settings')");
    expect(controller).toContain("@Put('settings/:key')");
  });
});

describe('小程序同步岗位静态契约', () => {
  it('管理端设置页渲染运行开关，批次配置保持独立', () => {
    const template = readFileSync(
      resolve(__dirname, '../../../user-miniprogram/components/admin-panels/ops/index.wxml'),
      'utf8',
    );
    const logic = readFileSync(
      resolve(__dirname, '../../../user-miniprogram/components/admin-panels/ops/index.ts'),
      'utf8',
    );
    expect(template).toContain('系统同步配置');
    expect(template).toContain('家教自动同步');
    expect(template).toContain('每 5 分钟执行');
    expect(template).toContain('1-200 条');
    expect(template).toContain('全量总数不限');
    expect(template).toContain('checked="{{tutorSyncEnabled}}"');
    expect(template).toContain(
      'disabled="{{loading || !appSettingsLoaded || togglingNeedReview || togglingTutorSync || savingTutorSync}}"',
    );
    expect(logic).toContain("item.key === 'tutor_sync.enabled'");
    expect(logic).toContain("updateAppSetting('tutor_sync.enabled', next)");
    expect(logic).toContain("updateAppSetting('tutor_sync.max_demands', batchSize)");
    expect(template).not.toMatch(/TUTOR_SYNC_TOKEN|TUTOR_SYNC_URL/);
  });

  it('管理端运行开关加载、成功、失败回滚和重复操作保护均生效', async () => {
    const { component, getAppSettings, updateAppSetting } = buildOpsSettingsComponent();
    getAppSettings.mockResolvedValue([
      { key: TUTOR_SYNC_ENABLED_KEY, value: false },
      { key: TUTOR_SYNC_BATCH_SIZE_KEY, value: 150 },
    ]);

    await component.load();
    expect(component.data).toMatchObject({
      loading: false,
      tutorSyncEnabled: false,
      tutorSyncBatchSize: '150',
      tutorSyncConfirmedBatchSize: '150',
      appSettingsLoaded: true,
    });

    component.data.loading = true;
    await component.toggleTutorSync({ detail: { value: true } });
    expect(updateAppSetting).not.toHaveBeenCalled();
    component.data.loading = false;

    let resolveUpdate: ((value: unknown) => void) | undefined;
    updateAppSetting.mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolveUpdate = resolvePromise;
      }),
    );
    const enabling = component.toggleTutorSync({ detail: { value: true } });
    expect(component.data).toMatchObject({
      tutorSyncEnabled: true,
      togglingTutorSync: true,
    });
    await component.toggleTutorSync({ detail: { value: false } });
    expect(updateAppSetting).toHaveBeenCalledTimes(1);
    await component.load();
    expect(getAppSettings).toHaveBeenCalledTimes(1);
    resolveUpdate?.({ key: TUTOR_SYNC_ENABLED_KEY, value: true });
    await enabling;
    expect(component.data).toMatchObject({
      tutorSyncEnabled: true,
      togglingTutorSync: false,
    });

    component.data.loading = true;
    await component.saveTutorSyncSettings();
    expect(updateAppSetting).toHaveBeenCalledTimes(1);
    component.data.loading = false;

    let resolveBatchSize: ((value: unknown) => void) | undefined;
    updateAppSetting.mockReturnValueOnce(
      new Promise((resolvePromise) => {
        resolveBatchSize = resolvePromise;
      }),
    );
    component.data.tutorSyncBatchSize = '180';
    const savingBatchSize = component.saveTutorSyncSettings();
    expect(component.data.savingTutorSync).toBe(true);
    await component.load();
    expect(getAppSettings).toHaveBeenCalledTimes(1);
    resolveBatchSize?.({ key: TUTOR_SYNC_BATCH_SIZE_KEY, value: 180 });
    await savingBatchSize;
    expect(updateAppSetting).toHaveBeenCalledTimes(2);
    expect(updateAppSetting).toHaveBeenLastCalledWith(TUTOR_SYNC_BATCH_SIZE_KEY, 180);
    expect(component.data).toMatchObject({
      tutorSyncBatchSize: '180',
      tutorSyncConfirmedBatchSize: '180',
      savingTutorSync: false,
    });

    updateAppSetting.mockRejectedValueOnce(new Error('network down'));
    component.data.tutorSyncBatchSize = '190';
    await component.saveTutorSyncSettings();
    expect(updateAppSetting).toHaveBeenCalledTimes(3);
    expect(component.data).toMatchObject({
      tutorSyncBatchSize: '180',
      tutorSyncConfirmedBatchSize: '180',
      savingTutorSync: false,
    });

    updateAppSetting.mockRejectedValueOnce(new Error('network down'));
    await component.toggleTutorSync({ detail: { value: false } });
    expect(updateAppSetting).toHaveBeenCalledTimes(4);
    expect(component.data).toMatchObject({
      tutorSyncEnabled: true,
      togglingTutorSync: false,
    });
  });

  it('管理端首次设置加载失败时禁止保存占位配置', async () => {
    const { component, getAppSettings, updateAppSetting } = buildOpsSettingsComponent();
    getAppSettings.mockRejectedValueOnce(new Error('network down'));

    await component.load();
    expect(component.data).toMatchObject({
      loading: false,
      appSettingsLoaded: false,
      tutorSyncEnabled: false,
      tutorSyncBatchSize: '100',
    });
    await component.toggleTutorSync({ detail: { value: true } });
    await component.saveTutorSyncSettings();
    expect(updateAppSetting).not.toHaveBeenCalled();
  });

  it('管理端重叠加载只允许最新请求更新开关和 loading', async () => {
    const { component, getAppSettings } = buildOpsSettingsComponent();
    let resolveFirst: ((value: unknown) => void) | undefined;
    getAppSettings
      .mockReturnValueOnce(
        new Promise((resolvePromise) => {
          resolveFirst = resolvePromise;
        }),
      )
      .mockResolvedValueOnce([
        { key: TUTOR_SYNC_ENABLED_KEY, value: true },
        { key: TUTOR_SYNC_BATCH_SIZE_KEY, value: 180 },
      ]);

    const firstLoad = component.load();
    const secondLoad = component.load();
    await secondLoad;
    expect(component.data).toMatchObject({
      loading: false,
      tutorSyncEnabled: true,
      tutorSyncBatchSize: '180',
      tutorSyncConfirmedBatchSize: '180',
      appSettingsLoaded: true,
      loadRequestId: 2,
    });

    resolveFirst?.([
      { key: TUTOR_SYNC_ENABLED_KEY, value: false },
      { key: TUTOR_SYNC_BATCH_SIZE_KEY, value: 100 },
    ]);
    await firstLoad;
    expect(component.data).toMatchObject({
      loading: false,
      tutorSyncEnabled: true,
      tutorSyncBatchSize: '180',
      tutorSyncConfirmedBatchSize: '180',
      appSettingsLoaded: true,
      loadRequestId: 2,
    });
  });

  it('详情禁用报名并展示固定红色联系提示', () => {
    const template = readFileSync(
      resolve(__dirname, '../../../user-miniprogram/pages/job/detail/index.wxml'),
      'utf8',
    );
    const style = readFileSync(
      resolve(__dirname, '../../../user-miniprogram/pages/job/detail/index.wxss'),
      'utf8',
    );
    expect(template).toContain('contactInstruction');
    expect(template).toContain(
      '<button class="apply-btn" disabled="{{true}}">请联系发布方报名</button>',
    );
    expect(style).toContain('color: #F53F3F');
    expect(TUTOR_SYNC_CONTACT_INSTRUCTION).toBe('此岗位需联系13057867818（同微信）');
  });

  it('服务端岗位VO仍固定展示森阳家教并禁止站内报名', () => {
    const jobService = readFileSync(
      resolve(__dirname, '../../src/modules/job/job.service.ts'),
      'utf8',
    );
    expect(jobService).toContain('applyMode === JobApplyMode.CONTACT_ONLY');
    expect(jobService).toContain('tutorJobPolicy.contactInstruction(p)');
    expect(jobService).toContain('validityText: p.expireAt === null');
  });
});

describe('同步全圈可见策略', () => {
  it('可见性过滤允许全圈同步岗位，同时普通岗位仍按当前圈隔离', () => {
    const filters = new JobVisibilityPolicyService().buildFilters(
      'community_a',
      new Date('2026-08-29T08:00:00.000Z'),
    );
    expect(filters).toEqual([
      {
        OR: [
          { visibilityScope: JobVisibilityScope.ALL_COMMUNITIES },
          {
            communityId: 'community_a',
            community: { is: { status: CommunityStatus.ACTIVE } },
          },
        ],
      },
      {
        OR: [{ expireAt: null }, { expireAt: { gt: new Date('2026-08-29T08:00:00.000Z') } }],
      },
    ]);
  });
});
