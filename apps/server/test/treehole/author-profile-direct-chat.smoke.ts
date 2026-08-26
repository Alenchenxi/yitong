/* eslint-disable no-console */
import { HttpStatus } from '@nestjs/common';
import { CommunityStatus, MatchKind, MatchStatus, PostStatus } from '@prisma/client';
import { BizException } from '../../src/common/exceptions/biz.exception';
import { TreeholeService } from '../../src/modules/treehole/treehole.service';

type Call = { name: string; args: any };

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  passed += 1;
  console.log(`  PASS ${message}`);
}

function createService(options: { blocked?: boolean; profile?: any; posts?: any[] } = {}) {
  const calls: Call[] = [];
  const profile = options.profile === undefined
    ? {
        nickname: '月光信箱',
        avatar: 'moon',
        personalityTags: ['慢热'],
        interestTags: ['音乐'],
        moodState: '平静',
      }
    : options.profile;
  const posts = options.posts ?? [];
  const service = Object.create(TreeholeService.prototype) as TreeholeService;
  const subject = service as any;
  subject.prisma = {
    anonymousProfile: {
      findUnique: async (args: any) => {
        calls.push({ name: 'profile.findUnique', args });
        if (args.select?.userId) return { userId: 'internal-user-id' };
        return profile;
      },
    },
    anonymousPost: {
      count: async (args: any) => {
        calls.push({ name: 'post.count', args });
        return 2;
      },
      findMany: async (args: any) => {
        calls.push({ name: 'post.findMany', args });
        return posts;
      },
    },
    anonBlock: {
      findFirst: async (args: any) => {
        calls.push({ name: 'block.findFirst', args });
        return options.blocked ? { id: 'block-1' } : null;
      },
    },
    chatMatch: {
      upsert: async (args: any) => {
        calls.push({ name: 'match.upsert', args });
        return {
          id: 'direct-match-1',
          anonIdA: args.create.anonIdA,
          anonIdB: args.create.anonIdB,
          kind: MatchKind.DIRECT,
          status: MatchStatus.ACTIVE,
          matchedTags: [],
          expireAt: null,
        };
      },
      findFirst: async (args: any) => {
        calls.push({ name: 'match.findFirst', args });
        return null;
      },
      findUnique: async (args: any) => {
        calls.push({ name: 'match.findUnique', args });
        return null;
      },
    },
  };
  subject.community = {
    resolveFeedCommunityId: async () => 'community-1',
  };
  subject.im = {
    getImCredential: async (anonId: string) => ({
      loginUserId: anonId,
      loginToken: 'token',
      wsUrl: 'ws://example.test',
    }),
  };
  subject.getDisplayTags = async () => ['音乐'];
  subject.match = async () => ({ waiting: true });
  return { service, calls };
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
  {
    const { service, calls } = createService();
    const result = await service.getAuthor('anon-viewer', 'anon-author');
    assert(result.nickname === '月光信箱', '作者主页返回匿名昵称');
    assert(result.postCount === 2, '作者主页返回当前圈子动态数');
    assert(!('userId' in result), '作者主页不返回 userId');
    assert(!('uid' in result), '作者主页不返回 uid');
    assert(!('openid' in result), '作者主页不返回 openid');
    const profileCall = calls.find((call) => call.name === 'profile.findUnique' && call.args.select?.nickname);
    assert(profileCall?.args.select.userId === undefined, '作者资料查询不选择真实 userId');
    const countCall = calls.find((call) => call.name === 'post.count');
    assert(countCall?.args.where.communityId === 'community-1', '动态数限定当前圈子');
    assert(countCall?.args.where.status === PostStatus.APPROVED, '动态数只统计审核通过帖子');
    assert(countCall?.args.where.community.is.status === CommunityStatus.ACTIVE, '动态数只统计有效圈子');
  }

  {
    const { service, calls } = createService({
      posts: [{
        id: 'post-1',
        anonId: 'anon-author',
        communityId: 'community-1',
        content: '今天也要认真生活',
        images: [],
        mood: '平静',
        likeCount: 3,
        viewCount: 8,
        boostUntil: null,
        createdAt: new Date('2026-08-26T10:00:00.000Z'),
        likes: [{ id: 'like-1' }],
        _count: { comments: 2 },
      }],
    });
    const result = await service.listAuthorPosts('anon-viewer', 'anon-author', undefined, 20);
    assert(result.list.length === 1, '作者动态返回帖子列表');
    assert(result.list[0]?.liked === true, '作者动态按浏览者匿名身份返回点赞态');
    assert(!('userId' in (result.list[0] ?? {})), '作者动态不返回真实 userId');
    const listCall = calls.find((call) => call.name === 'post.findMany');
    assert(listCall?.args.where.anonId === 'anon-author', '作者动态限定目标匿名身份');
    assert(listCall?.args.where.communityId === 'community-1', '作者动态限定当前圈子');
    assert(listCall?.args.include.likes.where.anonId === 'anon-viewer', '点赞态使用浏览者 anonId');
  }

  {
    const { service, calls } = createService();
    const result = await service.directChat('anon-z', 'anon-a');
    assert(result.matchId === 'direct-match-1', '直聊返回有效 matchId');
    assert(result.peerAnonId === 'anon-a', '直聊返回目标匿名身份');
    assert(result.matchKind === MatchKind.DIRECT, '直聊返回 DIRECT 会话类型');
    assert(result.expireAt === null, '直聊会话不过期');
    const upsertCall = calls.find((call) => call.name === 'match.upsert');
    assert(upsertCall?.args.where.directKey === 'anon-a:anon-z', '直聊使用稳定的无向身份对键');
    assert(upsertCall?.args.create.kind === MatchKind.DIRECT, '新建会话标记为 DIRECT');
    assert(upsertCall?.args.create.expireAt === null, '新建 DIRECT 会话不设置到期时间');
    assert(upsertCall?.args.update.status === MatchStatus.ACTIVE, '已有 DIRECT 会话恢复为 ACTIVE');
  }

  {
    const { service } = createService({ blocked: true });
    await expectBizError(
      () => service.getAuthor('anon-viewer', 'anon-author'),
      30005,
      HttpStatus.FORBIDDEN,
      '屏蔽关系查看作者主页',
    );
  }

  {
    const { service } = createService({ profile: null });
    await expectBizError(
      () => service.getAuthor('anon-viewer', 'anon-missing'),
      30012,
      HttpStatus.NOT_FOUND,
      '不存在的匿名作者',
    );
  }

  {
    const { service } = createService();
    await expectBizError(
      () => service.directChat('anon-self', 'anon-self'),
      30004,
      HttpStatus.BAD_REQUEST,
      '与自己直聊',
    );
  }

  {
    const { service, calls } = createService();
    await (service as any).findActiveMatch('anon-viewer');
    const findCall = calls.find((call) => call.name === 'match.findFirst');
    assert(findCall?.args.where.kind === MatchKind.RANDOM, '随机匹配只恢复 RANDOM 会话');
  }

  {
    const { service, calls } = createService();
    (service as any).prisma.chatMatch.findUnique = async () => ({
      id: 'direct-match-1',
      anonIdA: 'anon-viewer',
      anonIdB: 'anon-author',
      kind: MatchKind.DIRECT,
      status: MatchStatus.ACTIVE,
    });
    await expectBizError(
      () => service.skipMatch('anon-viewer', 'direct-match-1'),
      30010,
      HttpStatus.BAD_REQUEST,
      '跳过直接聊天',
    );
    assert(!calls.some((call) => call.name === 'match.upsert'), '跳过 DIRECT 不创建其他会话');
  }

  {
    const service = Object.create(TreeholeService.prototype) as TreeholeService;
    const subject = service as any;
    const matchUpdates: any[] = [];
    const noOpUpdateMany = async () => ({ count: 0 });
    const tx = {
      anonymousPost: { updateMany: noOpUpdateMany },
      anonPostLike: { updateMany: noOpUpdateMany },
      chatMatch: {
        findMany: async () => [
          { id: 'direct-1', anonIdA: 'anon-old', anonIdB: 'anon-peer', kind: MatchKind.DIRECT },
          { id: 'random-1', anonIdA: 'anon-peer-2', anonIdB: 'anon-old', kind: MatchKind.RANDOM },
        ],
        update: async (args: any) => {
          matchUpdates.push(args);
          return args;
        },
      },
      chatMessage: { updateMany: noOpUpdateMany },
      chatSession: { updateMany: noOpUpdateMany },
      anonymousProfile: {
        update: async () => ({ id: 'profile-1', anonId: 'anon-new' }),
      },
    };
    subject.generateAnonId = () => 'anon-new';
    subject.prisma = { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) };
    subject.logger = { warn: () => undefined };
    await subject.rotateUnsafeAnonId('profile-1', 'anon-old');
    const directUpdate = matchUpdates.find((item) => item.where.id === 'direct-1');
    const randomUpdate = matchUpdates.find((item) => item.where.id === 'random-1');
    assert(directUpdate.data.anonIdA === 'anon-new', '匿名 ID 轮换同步 DIRECT 参与者');
    assert(directUpdate.data.directKey === 'anon-new:anon-peer', '匿名 ID 轮换重算 DIRECT 唯一键');
    assert(randomUpdate.data.anonIdB === 'anon-new', '匿名 ID 轮换同步 RANDOM 参与者');
    assert(randomUpdate.data.directKey === null, 'RANDOM 会话保持无直接会话键');
  }

  console.log(`\nauthor-profile-direct-chat smoke: ${passed} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
