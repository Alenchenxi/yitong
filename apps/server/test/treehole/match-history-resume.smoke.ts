/* eslint-disable no-console */
import { HttpStatus } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { TreeholeService } from '../../src/modules/treehole/treehole.service';

interface MatchFixture {
  id: string;
  anonIdA: string;
  anonIdB: string;
  status: MatchStatus;
  matchScore: number;
  matchedTags: string[];
  expireAt: Date | null;
}

interface Subject {
  prisma: {
    chatMatch: {
      findUnique: (args: unknown) => Promise<MatchFixture | null>;
      update: (args: unknown) => Promise<MatchFixture>;
    };
  };
  im: {
    getImCredential: (anonId: string) => Promise<{
      loginUserId: string;
      loginToken: string;
      wsUrl: string;
    }>;
  };
  isBlockedEither: (anonId: string, peerAnonId: string) => Promise<boolean>;
  getDisplayTags: (anonId: string) => Promise<string[]>;
}

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  passed += 1;
  console.log(`  PASS ${message}`);
}

function createService(
  match: MatchFixture | null,
  options: { blocked?: boolean } = {},
): { service: TreeholeService; updates: unknown[]; credentialCalls: string[] } {
  const service = Object.create(TreeholeService.prototype) as TreeholeService;
  const subject = service as unknown as Subject;
  const updates: unknown[] = [];
  const credentialCalls: string[] = [];

  subject.prisma = {
    chatMatch: {
      findUnique: async () => match,
      update: async (args) => {
        updates.push(args);
        return { ...match!, status: MatchStatus.CLOSED };
      },
    },
  };
  subject.im = {
    getImCredential: async (anonId) => {
      credentialCalls.push(anonId);
      return { loginUserId: anonId, loginToken: 'token', wsUrl: 'ws://example.test' };
    },
  };
  subject.isBlockedEither = async () => options.blocked ?? false;
  subject.getDisplayTags = async () => ['夜猫子'];

  return { service, updates, credentialCalls };
}

async function expectBizError(
  action: () => Promise<unknown>,
  code: number,
  status: HttpStatus,
  label: string,
): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof BizException, `${label} 抛 BizException`);
  const biz = caught as BizException;
  assert(biz.bizCode === code, `${label} 错误码为 ${code}`);
  assert(biz.getStatus() === status, `${label} HTTP 状态为 ${status}`);
}

async function main(): Promise<void> {
  const active: MatchFixture = {
    id: 'match-1',
    anonIdA: 'anon-a',
    anonIdB: 'anon-b',
    status: MatchStatus.ACTIVE,
    matchScore: 88,
    matchedTags: ['夜猫子'],
    expireAt: new Date(Date.now() + 60_000),
  };

  {
    const { service, updates, credentialCalls } = createService(active);
    const result = await service.resumeMatch('anon-b', active.id);
    assert(result.matchId === active.id, '活跃历史恢复原 matchId');
    assert(result.peerAnonId === 'anon-a', '活跃历史恢复原 peerAnonId');
    assert(result.waiting === false, '恢复接口不返回 waiting');
    assert(result.imCredential.loginUserId === 'anon-b', '恢复接口返回当前匿名身份 IM 凭证');
    assert(updates.length === 0, '活跃恢复不修改匹配记录');
    assert(credentialCalls.length === 1, '活跃恢复仅申请一次 IM 凭证');
  }

  {
    const { service, credentialCalls } = createService({ ...active, status: MatchStatus.CLOSED });
    await expectBizError(
      () => service.resumeMatch('anon-b', active.id),
      30010,
      HttpStatus.GONE,
      '已关闭匹配',
    );
    assert(credentialCalls.length === 0, '已关闭匹配不申请 IM 凭证');
  }

  {
    const { service, updates, credentialCalls } = createService({
      ...active,
      expireAt: new Date(Date.now() - 60_000),
    });
    await expectBizError(
      () => service.resumeMatch('anon-b', active.id),
      30010,
      HttpStatus.GONE,
      '已过期匹配',
    );
    assert(updates.length === 1, '已过期匹配惰性关闭');
    assert(credentialCalls.length === 0, '已过期匹配不申请 IM 凭证');
  }

  {
    const { service } = createService(active);
    await expectBizError(
      () => service.resumeMatch('anon-other', active.id),
      10003,
      HttpStatus.FORBIDDEN,
      '非匹配参与者',
    );
  }

  {
    const { service, updates, credentialCalls } = createService(active, { blocked: true });
    await expectBizError(
      () => service.resumeMatch('anon-b', active.id),
      30005,
      HttpStatus.FORBIDDEN,
      '已屏蔽关系',
    );
    assert(updates.length === 1, '已屏蔽关系关闭残留活跃匹配');
    assert(credentialCalls.length === 0, '已屏蔽关系不申请 IM 凭证');
  }

  console.log(`\nmatch-history-resume smoke: ${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
