/* eslint-disable no-console */
import 'reflect-metadata';
// 树洞评论内容安全单测（自包含：直接 new TreeholeService + fake，不依赖 DB / docker）
// 背景：dev mock 下 moderation.checkText 被跳过（moderation.service.ts），HTTP smoke 无法触发 90002，
//       故用单测直接注入命中 90002 的 moderation fake，断言：
//         1. createComment 命中 checkText 抛 90002（BizException.bizCode === 90002）
//         2. 命中后不写 anon_comments（anonComment.create 不被调用）
//         3. 帖不存在抛 40001、双向屏蔽抛 30005 的既有分支不被破坏
import { JwtService } from '@nestjs/jwt';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { TreeholeService } from '../../src/modules/treehole/treehole.service';
import { ModerationService } from '../../src/modules/moderation/moderation.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ImService } from '../../src/modules/chat/im.service';
import { ChatService } from '../../src/modules/chat/chat.service';
import { CommunityService } from '../../src/modules/community/community.service';
import { PublicationPolicyService } from '../../src/modules/publication/publication-policy.service';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) { passed += 1; console.log(`  PASS ${msg}`); }
  else { failed += 1; console.error(`  FAIL ${msg}`); }
}

async function assertThrows(
  fn: () => unknown | Promise<unknown>,
  msg: string,
  check?: (e: unknown) => boolean,
): Promise<void> {
  let threw: unknown = null;
  try {
    const r = fn();
    if (r && typeof (r as { then?: unknown }).then === 'function') {
      await (r as Promise<unknown>);
    }
  } catch (e) {
    threw = e;
  }
  if (threw === null) { assert(false, `${msg}（未抛异常）`); return; }
  const ok = check ? check(threw) : true;
  const detail = threw instanceof BizException ? `bizCode=${threw.bizCode}` : (threw as Error).message;
  assert(ok, `${msg}（抛 ${detail}）`);
}

function makeModeration(hit: boolean): ModerationService {
  return {
    checkText: async () => {
      if (hit) throw new BizException(90002, '内容不合规', 400);
    },
    checkImage: async () => undefined,
  } as unknown as ModerationService;
}

interface FakePrisma {
  anonymousProfile: { findUnique: () => Promise<{ userId: string }> };
  anonymousPost: { findFirst: () => Promise<{ id: string; anonId: string } | null> };
  anonBlock: { findFirst: () => Promise<{ id: string } | null> };
  anonComment: { create: () => Promise<{ id: string; postId: string; anonId: string; content: string; likeCount: number; createdAt: Date }> };
}

function makePrisma(opts: { post: boolean; blocked: boolean }): { fake: FakePrisma; created: () => number } {
  let created = 0;
  const fake: FakePrisma = {
    anonymousProfile: {
      findUnique: async () => ({ userId: 'user_1' }),
    },
    anonymousPost: {
      findFirst: async () => (opts.post ? { id: 'post_1', anonId: 'anon_author' } : null),
    },
    anonBlock: {
      findFirst: async () => (opts.blocked ? { id: 'block_1' } : null),
    },
    anonComment: {
      create: async () => {
        created += 1;
        return { id: 'c1', postId: 'post_1', anonId: 'anon_author', content: '正常内容', likeCount: 0, createdAt: new Date() };
      },
    },
  };
  return { fake, created: () => created };
}

function newService(fake: FakePrisma, moderation: ModerationService): TreeholeService {
  return new TreeholeService(
    fake as unknown as PrismaService,
    {} as JwtService,
    moderation,
    {} as unknown as ImService,
    {} as unknown as ChatService,
    {
      getActiveCommunityId: async () => 'cm_default',
    } as unknown as CommunityService,
    {
      anonymousPostVisibilityFilter: () => ({}),
      assertAnonCommunityInteractionAllowed: async () => undefined,
    } as unknown as PublicationPolicyService,
  );
}

async function run(): Promise<void> {
  console.log('\n========== 树洞评论内容安全（90002）==========');

  // 1. checkText 命中 → createComment 抛 90002 且不写库
  {
    const { fake, created } = makePrisma({ post: true, blocked: false });
    const svc = newService(fake, makeModeration(true));
    await assertThrows(
      () => svc.createComment('anon_me', 'post_1', '违规内容'),
      'checkText 命中抛 90002',
      (e) => e instanceof BizException && e.bizCode === 90002,
    );
    assert(created() === 0, 'checkText 命中后不写 anon_comments');
  }

  // 2. 帖不存在 → 40001（moderation 不被调用）
  {
    const { fake } = makePrisma({ post: false, blocked: false });
    const svc = newService(fake, makeModeration(false));
    await assertThrows(
      () => svc.createComment('anon_me', 'missing', '正常内容'),
      '帖不存在抛 40001',
      (e) => e instanceof BizException && e.bizCode === 40001,
    );
  }

  // 3. 双向屏蔽 → 30005（moderation 不被调用）
  {
    const { fake } = makePrisma({ post: true, blocked: true });
    const svc = newService(fake, makeModeration(false));
    await assertThrows(
      () => svc.createComment('anon_me', 'post_1', '正常内容'),
      '双向屏蔽抛 30005',
      (e) => e instanceof BizException && e.bizCode === 30005,
    );
  }

  // 4. 正常路径：checkText 通过 → 写库成功，返回 isLZ=true（楼主）
  {
    const { fake, created } = makePrisma({ post: true, blocked: false });
    const svc = newService(fake, makeModeration(false));
    const vo = await svc.createComment('anon_author', 'post_1', '正常内容');
    assert(created() === 1, '正常路径写库一次');
    assert(vo.isLZ === true && vo.authorAnonId === 'anon_author', '楼主评论 isLZ=true 且 authorAnonId 正确');
    assert(!('uid' in vo) && !('userId' in vo), 'VO 不含真实 uid');
  }

  console.log(`\n========== 结果：${passed} 通过, ${failed} 失败 ==========`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('test run failed:', e);
  process.exit(1);
});
