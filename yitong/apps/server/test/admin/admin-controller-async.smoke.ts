/* eslint-disable no-console */
// 修复验证冒烟：验证 admin.controller.ts 中 5 处同步 controller 调 async service 已改为 async/await。
// 运行：pnpm --filter @yitong/server exec ts-node test/admin/admin-controller-async.smoke.ts
//
// 背景（与 memory nestjs-controller-async-await.md 对应）：
//   同步 controller + ok(Promise) → 序列化 data 为 {}，前端拿到空对象。
//   同步 controller 调 async service 抛 BizException → Promise rejection 被当 unhandledRejection，
//   NestJS 异常过滤器抓不到非 Promise 返回 → 进程崩溃。
//
// 验证策略：
//   1) controller 方法返回值必须是 Promise（async 修复的关键证明）。
//   2) await resolve 后 .data 必须是真实数据（非 Promise 对象）。
//   3) service 抛 BizException 时，controller 返回的 Promise 必须 reject 该异常
//      （验证异常过滤器能捕获，不会 unhandledRejection）。
//
// 纯内存 FakeAdminService，不启动 Nest、不连接真实 DB。
import { AdminController } from '../../src/modules/admin/admin.controller';
import type { AdminService } from '../../src/modules/admin/admin.service';
import type { DashboardService } from '../../src/modules/admin/dashboard.service';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { HttpStatus } from '@nestjs/common';
import { ok } from '../../src/common/dto/api-response';


let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// 校验 controller 返回的 ok() 包络：{ code: 0, data, message }
// 修复后 data 是真实数据（数组或对象）。
function assertDataIsReal(
  resolved: { code: number; data: unknown; message: string },
  expectKind: 'array' | 'object',
  contextLabel: string,
): void {
  assert(resolved.code === 0, `${contextLabel} 包络 code === 0`);
  assert(resolved.data !== undefined && resolved.data !== null, `${contextLabel} data 非 null/undefined`);
  assert(
    !(resolved.data instanceof Promise),
    `${contextLabel} data 不是 Promise 对象（修复前会是 Promise，JSON.stringify = {}）`,
  );
  if (expectKind === 'array') {
    assert(Array.isArray(resolved.data), `${contextLabel} data 是数组`);
    assert((resolved.data as unknown[]).length > 0, `${contextLabel} data 非空数组`);
  } else {
    assert(typeof resolved.data === 'object', `${contextLabel} data 是对象`);
    const keys = Object.keys(resolved.data as object);
    assert(keys.length > 0, `${contextLabel} data 有字段（不是空对象）`);
  }
}

function fakeReq(openid: string): { user: { openid: string; uid: string; role: string } } {
  return { user: { openid, uid: `uid-${openid}`, role: 'ADMIN' } };
}

// 控制每个 service 方法返回什么、是否抛异常
type Behavior = 'ok' | 'throw';
interface AdminServiceBehavior {
  getSettings: Behavior;
  listAdmins: Behavior;
  searchCandidateUsers: Behavior;
  createAdmin: Behavior;
  deleteAdmin: Behavior;
}

const SAMPLE_SETTINGS = [
  { key: 'community.need_review', value: true, updatedAt: new Date().toISOString(), updatedBy: 'admin' },
];

const SAMPLE_ADMINS = [
  {
    id: 'a-1',
    username: 'alice',
    openid: 'openid-alice',
    createdAt: new Date().toISOString(),
    linkedUser: { id: 'u-1', nickname: '爱丽丝', avatarUrl: null },
    isSelf: false,
  },
];

const SAMPLE_USERS = [
  { id: 'u-1', nickname: '候选同学', avatarUrl: null, openid: 'openid-1' },
];

const SAMPLE_ADMIN_CREATED = {
  id: 'a-new',
  username: 'new-admin',
  openid: 'openid-new',
  createdAt: new Date().toISOString(),
  linkedUser: { id: 'u-1', nickname: '候选同学', avatarUrl: null },
};

const SAMPLE_ADMIN_DELETED = { id: 'a-1', deleted: true };

// 用 Proxy + 每方法自定义 flag，可同时对每个方法做"成功"或"抛 BizException"切换。
function makeFakeAdminService(behavior: AdminServiceBehavior): AdminService {
  const handler = {
    get(_target: object, prop: string | symbol) {
      if (prop === 'getSettings') {
        return async () => {
          if (behavior.getSettings === 'throw') throw new BizException(40004, 'test', HttpStatus.BAD_REQUEST);
          return SAMPLE_SETTINGS;
        };
      }
      if (prop === 'listAdmins') {
        return async () => {
          if (behavior.listAdmins === 'throw') throw new BizException(40004, 'test', HttpStatus.BAD_REQUEST);
          return SAMPLE_ADMINS;
        };
      }
      if (prop === 'searchCandidateUsers') {
        return async () => {
          if (behavior.searchCandidateUsers === 'throw')
            throw new BizException(40004, 'test', HttpStatus.BAD_REQUEST);
          return SAMPLE_USERS;
        };
      }
      if (prop === 'createAdmin') {
        return async () => {
          if (behavior.createAdmin === 'throw') throw new BizException(40004, 'test', HttpStatus.BAD_REQUEST);
          return SAMPLE_ADMIN_CREATED;
        };
      }
      if (prop === 'deleteAdmin') {
        return async () => {
          if (behavior.deleteAdmin === 'throw') throw new BizException(40004, 'test', HttpStatus.BAD_REQUEST);
          return SAMPLE_ADMIN_DELETED;
        };
      }
      // 其他 service 方法（controller 不直接测）返回 undefined 即可
      return undefined;
    },
  };
  // Proxy target 故意为 {}，handler 在 get 拦截时按方法名返回对应 stub；
  // 用 unknown 双步转型规避 AdminService 60+ 字段的协变检查
  return new Proxy({} as unknown as object, handler) as unknown as AdminService;
}

function controllerWith(behavior: AdminServiceBehavior): AdminController {
  const fakeService = makeFakeAdminService(behavior);
  const fakeDashboard = {} as DashboardService;
  return new AdminController(fakeService, fakeDashboard);
}

async function main(): Promise<void> {
  // ===== [1] getSettings() =====
  console.log('[1] getSettings()');
  {
    const controller = controllerWith({
      getSettings: 'ok',
      listAdmins: 'ok',
      searchCandidateUsers: 'ok',
      createAdmin: 'ok',
      deleteAdmin: 'ok',
    });
    const result = controller.getSettings();
    assert(result instanceof Promise, 'getSettings 返回值是 Promise（async 修复证明）');
    const resolved = await result;
    assertDataIsReal(resolved, 'array', 'getSettings');
  }

  // ===== [2] listAdmins(keyword, req) =====
  console.log('[2] listAdmins(@Query, @Req)');
  {
    const controller = controllerWith({
      getSettings: 'ok',
      listAdmins: 'ok',
      searchCandidateUsers: 'ok',
      createAdmin: 'ok',
      deleteAdmin: 'ok',
    });
    const result = controller.listAdmins({ keyword: 'alice' } as never, fakeReq('openid-self') as never);
    assert(result instanceof Promise, 'listAdmins 返回值是 Promise');
    const resolved = await result;
    assertDataIsReal(resolved, 'array', 'listAdmins');
  }

  // ===== [3] searchCandidateUsers(@Query) =====
  console.log('[3] searchCandidateUsers(@Query)');
  {
    const controller = controllerWith({
      getSettings: 'ok',
      listAdmins: 'ok',
      searchCandidateUsers: 'ok',
      createAdmin: 'ok',
      deleteAdmin: 'ok',
    });
    const result = controller.searchCandidateUsers({ keyword: '候选' } as never);
    assert(result instanceof Promise, 'searchCandidateUsers 返回值是 Promise');
    const resolved = await result;
    assertDataIsReal(resolved, 'array', 'searchCandidateUsers');
  }

  // ===== [4] createAdmin(@Body dto) =====
  console.log('[4] createAdmin(@Body dto)');
  {
    const controller = controllerWith({
      getSettings: 'ok',
      listAdmins: 'ok',
      searchCandidateUsers: 'ok',
      createAdmin: 'ok',
      deleteAdmin: 'ok',
    });
    const result = controller.createAdmin({ userId: 'u-1' } as never);
    assert(result instanceof Promise, 'createAdmin 返回值是 Promise');
    const resolved = await result;
    assertDataIsReal(resolved, 'object', 'createAdmin');
  }

  // ===== [5] deleteAdmin(@Param id, @Req) =====
  console.log('[5] deleteAdmin(@Param, @Req)');
  {
    const controller = controllerWith({
      getSettings: 'ok',
      listAdmins: 'ok',
      searchCandidateUsers: 'ok',
      createAdmin: 'ok',
      deleteAdmin: 'ok',
    });
    const result = controller.deleteAdmin('a-1', fakeReq('openid-self') as never);
    assert(result instanceof Promise, 'deleteAdmin 返回值是 Promise');
    const resolved = await result;
    assertDataIsReal(resolved, 'object', 'deleteAdmin');
  }

  // ===== [6] service throw → controller Promise reject 携带 BizException =====
  // 这是修复的关键目的之一：service 抛 BizException 必须经 controller 的 Promise 路径传播，
  // NestJS 异常过滤器才能捕获；同步 controller 不会抛 Promise rejection，会变 unhandledRejection。
  console.log('[6] service 抛 BizException → controller Promise reject 传播');
  {
    const cases: Array<{
      label: string;
      invoke: (ctrl: AdminController) => Promise<unknown>;
      flip: AdminServiceBehavior;
    }> = [
      {
        label: 'getSettings throw',
        invoke: (c) => c.getSettings(),
        flip: {
          getSettings: 'throw',
          listAdmins: 'ok',
          searchCandidateUsers: 'ok',
          createAdmin: 'ok',
          deleteAdmin: 'ok',
        },
      },
      {
        label: 'listAdmins throw',
        invoke: (c) => c.listAdmins({} as never, fakeReq('openid-self') as never),
        flip: {
          getSettings: 'ok',
          listAdmins: 'throw',
          searchCandidateUsers: 'ok',
          createAdmin: 'ok',
          deleteAdmin: 'ok',
        },
      },
      {
        label: 'searchCandidateUsers throw',
        invoke: (c) => c.searchCandidateUsers({ keyword: 'x' } as never),
        flip: {
          getSettings: 'ok',
          listAdmins: 'ok',
          searchCandidateUsers: 'throw',
          createAdmin: 'ok',
          deleteAdmin: 'ok',
        },
      },
      {
        label: 'createAdmin throw',
        invoke: (c) => c.createAdmin({ userId: 'u-1' } as never),
        flip: {
          getSettings: 'ok',
          listAdmins: 'ok',
          searchCandidateUsers: 'ok',
          createAdmin: 'throw',
          deleteAdmin: 'ok',
        },
      },
      {
        label: 'deleteAdmin throw',
        invoke: (c) => c.deleteAdmin('a-1', fakeReq('openid-self') as never),
        flip: {
          getSettings: 'ok',
          listAdmins: 'ok',
          searchCandidateUsers: 'ok',
          createAdmin: 'ok',
          deleteAdmin: 'throw',
        },
      },
    ];

    for (const tc of cases) {
      const controller = controllerWith(tc.flip);
      let captured: unknown = undefined;
      let rejected = false;
      try {
        await tc.invoke(controller);
      } catch (e) {
        rejected = true;
        captured = e;
      }
      assert(rejected, `${tc.label} → controller Promise reject（验证异常过滤器可捕获）`);
      assert(
        captured instanceof BizException && captured.bizCode === 40004,
        `${tc.label} → reject error 是 BizException(40004)`,
      );
    }
  }

  // ===== [7] 反向证明：构造一个"假同步"版本，模拟修复前行为，确认会触发空 data 问题 =====
  // 这一节不调用真实 controller（已经是修复后），而是用一个匿名 inline 类，演示：
  //   同步 controller + ok(Promise) → resolved.data 实际是 Promise 对象，序列化变 {}。
  // 用于文档化"为什么必须 async"的回归证据。
  console.log('[7] 反向对照：同步 controller 调 async service → data 是 Promise 对象');
  {
    class SyncLikeController {
      constructor(private readonly admin: AdminService) {}
      getSettingsLikeSyncBug(): { code: number; data: unknown } {
        // 修复前会这么写：直接 return ok(<Promise>)，没 await
        return ok((this.admin as unknown as { getSettings: () => Promise<unknown> }).getSettings());
      }
    }
    const syncCtrl = new SyncLikeController(makeFakeAdminService({
      getSettings: 'ok',
      listAdmins: 'ok',
      searchCandidateUsers: 'ok',
      createAdmin: 'ok',
      deleteAdmin: 'ok',
    }));
    const bad = syncCtrl.getSettingsLikeSyncBug();
    // 关键证据：data 是 Promise
    assert(bad.data instanceof Promise, '修复前形态：包络的 data 字段是 Promise 对象');
    // JSON.stringify(Promise) === "{}" —— 这就是生产环境的空 data 来源
    assert(JSON.stringify(bad.data) === '{}', 'JSON.stringify(Promise) === "{}"，前端拿到 data: {}');
  }

  console.log(`\n==== controller async/await 修复验证：${passed} 通过 / ${failed} 失败 ====`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('冒烟测试异常:', error);
  process.exit(1);
});
