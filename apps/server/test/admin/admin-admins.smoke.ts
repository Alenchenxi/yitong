/* eslint-disable no-console */
// 管理员自助管理冒烟测试：纯内存 FakePrisma，不启动 Nest、不连接真实数据库。
// 运行：pnpm --filter @yitong/server exec ts-node test/admin/admin-admins.smoke.ts
import { Role } from '@prisma/client';
import { AdminService } from '../../src/modules/admin/admin.service';
import { TutorJobPolicyService } from '../../src/modules/tutor-sync/tutor-job-policy.service';
import { BizException } from '../../src/common/exceptions/biz.exception';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { ConfessionService } from '../../src/modules/confession/confession.service';
import type { NotificationService } from '../../src/modules/notification/notification.service';

type FakeUser = {
  id: string;
  openid: string | null;
  nickname: string;
  avatarUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
};
type FakeAdmin = {
  id: string;
  username: string;
  openid: string | null;
  createdAt: Date;
};
type FakeUserRole = { userId: string; role: Role };

type FakeUserFindUniqueArgs = { where: { id?: string; openid?: string }; select?: { id?: boolean } };
type FakeUserFindManyArgs = {
  where?: {
    openid?: { in: string[] };
    deletedAt?: null;
    nickname?: { contains: string; mode?: string };
    NOT?: { openid?: { in: string[] } };
  };
  select?: Record<string, boolean>;
  take?: number;
};
type FakeAdminFindManyArgs = {
  where?: { OR?: Array<{ username?: { contains: string }; openid?: { contains: string } }> };
  select?: { openid?: boolean };
};
type FakeAdminUpsertArgs = {
  where: { openid: string };
  create: { openid: string; username: string };
};
type FakeRoleUpsertArgs = { where: { userId_role: FakeUserRole }; create: FakeUserRole };

class FakePrisma {
  users: FakeUser[] = [];
  admins: FakeAdmin[] = [];
  roles: FakeUserRole[] = [];
  private nextAdminId = 1;

  // 字段类型用 any 规避 FakePrisma 与 PrismaService 双向协变；运行时 fake 行为完整
  user = {
    findUnique: async (_args: any): Promise<unknown> => undefined,
    findMany: async (_args: any): Promise<unknown[]> => [],
  };

  adminUser = {
    findMany: async (_args: any): Promise<unknown[]> => [],
    findUnique: async (_args: any): Promise<unknown> => undefined,
    upsert: async (_args: any): Promise<unknown> => undefined,
    count: async (): Promise<number> => 0,
    delete: async (_args: any): Promise<unknown> => undefined,
  };

  userRole = {
    upsert: async (_args: any): Promise<unknown> => undefined,
    deleteMany: async (_args: any): Promise<{ count: number }> => ({ count: 0 }),
  };

  constructor() {
    this.user.findUnique = async (args: { where: { id?: string; openid?: string }; select?: { id?: boolean } }) => {
      const found = this.users.find((u) =>
        args.where.id !== undefined ? u.id === args.where.id : u.openid === args.where.openid,
      );
      if (!found) return null;
      return args.select?.id ? { id: found.id } : { ...found };
    };

    this.user.findMany = async (args: {
      where?: {
        openid?: { in: string[] };
        deletedAt?: null;
        nickname?: { contains: string; mode?: string };
        NOT?: { openid?: { in: string[] } };
      };
      select?: Record<string, boolean>;
      take?: number;
    }) => {
      let rows = [...this.users];
      const where = args.where;
      if (where?.openid?.in) rows = rows.filter((u) => u.openid !== null && where.openid!.in.includes(u.openid));
      if (where && Object.prototype.hasOwnProperty.call(where, 'deletedAt')) {
        rows = rows.filter((u) => u.deletedAt === null);
      }
      if (where?.nickname?.contains) {
        const kw = where.nickname.contains.toLowerCase();
        rows = rows.filter((u) => u.nickname.toLowerCase().includes(kw));
      }
      const excluded = where?.NOT?.openid?.in;
      if (excluded) rows = rows.filter((u) => u.openid === null || !excluded.includes(u.openid));
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (args.take !== undefined) rows = rows.slice(0, args.take);
      if (!args.select) return rows.map((u) => ({ ...u }));
      return rows.map((u) => Object.fromEntries(
        Object.entries(args.select!).filter(([, enabled]) => enabled).map(([key]) => [key, u[key as keyof FakeUser]]),
      ));
    };

    this.adminUser.findMany = async (args: {
      where?: { OR?: Array<{ username?: { contains: string }; openid?: { contains: string } }> };
      select?: { openid?: boolean };
    }) => {
      let rows = [...this.admins];
      const ors = args.where?.OR;
      if (ors?.length) {
        rows = rows.filter((a) => ors.some((condition) => {
          const usernameKw = condition.username?.contains.toLowerCase();
          const openidKw = condition.openid?.contains.toLowerCase();
          return (usernameKw !== undefined && a.username.toLowerCase().includes(usernameKw))
            || (openidKw !== undefined && (a.openid ?? '').toLowerCase().includes(openidKw));
        }));
      }
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (args.select?.openid) return rows.map((a) => ({ openid: a.openid }));
      return rows.map((a) => ({ ...a }));
    };

    this.adminUser.findUnique = async (args: { where: { id: string } }) =>
      this.admins.find((a) => a.id === args.where.id) ?? null;

    this.adminUser.upsert = async (args: {
      where: { openid: string };
      create: { openid: string; username: string };
    }) => {
      const existing = this.admins.find((a) => a.openid === args.where.openid);
      if (existing) return { ...existing };
      const created: FakeAdmin = {
        id: `admin-${this.nextAdminId++}`,
        username: args.create.username,
        openid: args.create.openid,
        createdAt: new Date(),
      };
      this.admins.push(created);
      return { ...created };
    };

    this.adminUser.count = async () => this.admins.length;
    this.adminUser.delete = async (args: { where: { id: string } }) => {
      const index = this.admins.findIndex((a) => a.id === args.where.id);
      if (index < 0) throw new Error('FakePrisma admin not found');
      const [deleted] = this.admins.splice(index, 1);
      return deleted;
    };

    this.userRole.upsert = async (args: {
      where: { userId_role: FakeUserRole };
      create: FakeUserRole;
    }) => {
      const key = args.where.userId_role;
      const existing = this.roles.find((r) => r.userId === key.userId && r.role === key.role);
      if (existing) return { ...existing };
      this.roles.push({ ...args.create });
      return { ...args.create };
    };

    this.userRole.deleteMany = async (args: { where: FakeUserRole }) => {
      const before = this.roles.length;
      this.roles = this.roles.filter((r) => !(r.userId === args.where.userId && r.role === args.where.role));
      return { count: before - this.roles.length };
    };
  }
}

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

async function assertBizCode(action: () => Promise<unknown>, code: number, message: string): Promise<void> {
  try {
    await action();
    assert(false, `${message}（未抛异常）`);
  } catch (error) {
    const actual = error instanceof BizException ? error.bizCode : undefined;
    assert(actual === code, `${message}（bizCode=${String(actual)}）`);
  }
}

function user(
  id: string,
  nickname: string,
  openid: string | null,
  deletedAt: Date | null = null,
  ageMs = 0,
): FakeUser {
  return { id, nickname, openid, avatarUrl: `${id}.png`, deletedAt, createdAt: new Date(Date.now() - ageMs) };
}

function serviceFor(prisma: FakePrisma): AdminService {
  return new AdminService(
    prisma as unknown as PrismaService,
    {} as ConfessionService,
    {} as NotificationService,
    new TutorJobPolicyService(),
  );
}

async function main(): Promise<void> {
  console.log('[1] createAdmin 错误分支');
  {
    const prisma = new FakePrisma();
    prisma.users.push(user('no-openid', '未绑定用户', null));
    const service = serviceFor(prisma);
    await assertBizCode(() => service.createAdmin('missing'), 40001, '不存在的 userId 抛 40001');
    await assertBizCode(() => service.createAdmin('no-openid'), 40002, 'user.openid 为空抛 40002');
  }

  console.log('[2] createAdmin 成功同步 AdminUser 与 UserRole.ADMIN');
  {
    const prisma = new FakePrisma();
    prisma.users.push(user('u-create', '新增管理员', 'openid-create'));
    const result = await serviceFor(prisma).createAdmin('u-create');
    assert(prisma.admins.some((a) => a.id === result.id && a.openid === 'openid-create'), 'AdminUser 新增');
    assert(prisma.roles.some((r) => r.userId === 'u-create' && r.role === Role.ADMIN), 'UserRole.ADMIN 新增');
  }

  console.log('[3] deleteAdmin 保护与成功同步删除');
  {
    const prisma = new FakePrisma();
    prisma.users.push(user('u-self', '自己', 'openid-self'), user('u-peer', '同伴', 'openid-peer'));
    prisma.admins.push(
      { id: 'a-self', username: 'self', openid: 'openid-self', createdAt: new Date() },
      { id: 'a-peer', username: 'peer', openid: 'openid-peer', createdAt: new Date(Date.now() - 1) },
    );
    prisma.roles.push({ userId: 'u-self', role: Role.ADMIN }, { userId: 'u-peer', role: Role.ADMIN });
    const service = serviceFor(prisma);
    await assertBizCode(() => service.deleteAdmin('a-self', 'openid-self'), 40004, 'openid 匹配自己时抛 40004');
    const deleted = await service.deleteAdmin('a-peer', 'openid-self');
    assert(deleted.deleted && !prisma.admins.some((a) => a.id === 'a-peer'), '成功删除 AdminUser');
    assert(!prisma.roles.some((r) => r.userId === 'u-peer' && r.role === Role.ADMIN), '同步删除 UserRole.ADMIN');
  }
  {
    const prisma = new FakePrisma();
    prisma.admins.push({ id: 'only', username: 'only', openid: 'openid-only', createdAt: new Date() });
    await assertBizCode(() => serviceFor(prisma).deleteAdmin('only', 'someone-else'), 40005, 'AdminUser count===1 时抛 40005');
  }

  console.log('[4] searchCandidateUsers 过滤');
  {
    const prisma = new FakePrisma();
    prisma.users.push(
      user('u-ok', '候选同学', 'openid-ok'),
      user('u-admin', '候选管理员', 'openid-admin', null, 1),
      user('u-deleted', '候选封禁', 'openid-deleted', new Date(), 2),
      user('u-other', '其他同学', 'openid-other', null, 3),
    );
    prisma.admins.push({ id: 'a-admin', username: 'admin', openid: 'openid-admin', createdAt: new Date() });
    const rows = await serviceFor(prisma).searchCandidateUsers('候选');
    assert(rows.some((u) => u.id === 'u-ok'), '保留符合条件的候选用户');
    assert(!rows.some((u) => u.id === 'u-admin'), '排除已是 admin 的用户');
    assert(!rows.some((u) => u.id === 'u-deleted'), '排除 deletedAt!=null 的封禁用户');
    assert(!rows.some((u) => u.id === 'u-other'), '昵称关键词过滤生效');
  }
  {
    const prisma = new FakePrisma();
    prisma.users.push(user('u-ok', '候选同学', 'openid-ok'));
    await assertBizCode(() => serviceFor(prisma).searchCandidateUsers(''), 40006, '无 keyword 抛 40006');
    await assertBizCode(() => serviceFor(prisma).searchCandidateUsers('   '), 40006, '空白 keyword 抛 40006');
  }

  console.log('[5] listAdmins linkedUser 与 isSelf');
  {
    const prisma = new FakePrisma();
    prisma.users.push(user('u-linked', '已关联昵称', 'openid-linked'));
    prisma.admins.push(
      { id: 'a-linked', username: 'linked-admin', openid: 'openid-linked', createdAt: new Date() },
      { id: 'a-orphan', username: 'orphan-admin', openid: 'openid-orphan', createdAt: new Date(Date.now() - 1) },
    );
    const rows = await serviceFor(prisma).listAdmins(undefined, 'openid-linked');
    const linked = rows.find((a) => a.id === 'a-linked');
    const orphan = rows.find((a) => a.id === 'a-orphan');
    assert(linked?.linkedUser?.nickname === '已关联昵称', '有 User 匹配时 linkedUser 填昵称');
    assert(orphan?.linkedUser === null, '无 User 匹配时 linkedUser=null');
    assert(linked?.isSelf === true, 'openid 匹配时 isSelf=true');
    assert(orphan?.isSelf === false, 'openid 不匹配时 isSelf=false');
  }
  {
    const prisma = new FakePrisma();
    prisma.users.push(user('u-nickname-search', '展示昵称同学', 'openid-nickname-search'));
    prisma.admins.push({
      id: 'a-nickname-search',
      username: 'seed_admin_name',
      openid: 'openid-nickname-search',
      createdAt: new Date(),
    });
    const service = serviceFor(prisma);
    const rows = await service.listAdmins('展示昵称');
    assert(
      rows.some((a) => a.id === 'a-nickname-search' && a.linkedUser?.nickname === '展示昵称同学'),
      '管理员列表支持按关联 User.nickname 模糊搜索',
    );
    const usernameRows = await service.listAdmins('SEED_ADMIN');
    assert(usernameRows.some((a) => a.id === 'a-nickname-search'), '管理员列表支持按 username 忽略大小写模糊搜索');

    const openidRows = await service.listAdmins('NICKNAME-SEARCH');
    assert(openidRows.some((a) => a.id === 'a-nickname-search'), '管理员列表支持按 openid 忽略大小写模糊搜索');

    const allRows = await service.listAdmins('   ');
    assert(allRows.length === 1 && allRows[0]?.id === 'a-nickname-search', '空白 keyword 返回全量管理员');

  }

  console.log(`\n==== 管理员管理冒烟结果：${passed} 通过 / ${failed} 失败 ====`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('冒烟测试异常:', error);
  process.exit(1);
});
