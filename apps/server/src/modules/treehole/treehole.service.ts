import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MatchStatus, PostStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { ImService } from '../chat/im.service';
import { ChatService } from '../chat/chat.service';
import type { CreateAnonPostDto } from './dto/create-anon-post.dto';
import type { UpdateAnonProfileDto } from './dto/update-anon-profile.dto';
import {
  QUESTIONNAIRE_BANK,
  QUIZ_RESULT_CONFIG,
  type QuestionnaireType,
} from './questionnaire-bank';

// 错误码 3xxxx 树洞段（API §3）：30001 匿名态失效 / 30002 匹配无可用对象
// P1-17 限时聊天有效期（毫秒）：默认 24 小时
const MATCH_TTL_MS = parseInt(process.env.TREEHOLE_MATCH_TTL_MS || `${24 * 60 * 60 * 1000}`, 10);
const NICK_A = ['星河', '南门', '月光', '晚风', '深海', '森林', '云端', '陌路', '拾光', '孤岛'];
const NICK_B = ['边的猫', '第二棵树', '漫游者', '低语者', '失眠人', '观察者', '拾星人', '夜行人'];

// P0-12 匿名身份资料 VO（不含 userId/anonId，避免向前台泄露可追溯字段）
export interface AnonProfileVo {
  nickname: string;
  avatar: string | null;
  personalityTags: string[];
  interestTags: string[];
  moodState: string | null;
}

@Injectable()
export class TreeholeService {
  private readonly logger = new Logger(TreeholeService.name);
  // 内存匹配队列（MVP 单实例；生产用 Redis list）
  private readonly matchQueue: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly moderation: ModerationService,
    private readonly im: ImService,
    private readonly chat: ChatService,
  ) {}

  // 换匿名 token：find/create AnonymousProfile（userId->anonId，后台可追溯），签 anonToken（含 anonId，不含 uid）
  async getAnonymousToken(uid: string) {
    const profile = await this.getOrCreateProfile(uid);
    const anonToken = await this.jwt.signAsync(
      { anonId: profile.anonId, type: 'anon' },
      { expiresIn: '7d' },
    );
    return { anonId: profile.anonId, anonToken, nickname: profile.nickname };
  }

  // P1-14 获取问卷题库（公开，无需鉴权）
  getQuestionnaire(type: string) {
    const t = type as QuestionnaireType;
    const bank = QUESTIONNAIRE_BANK[t];
    if (!bank) throw new BizException(30007, '问卷类型不存在');
    return bank;
  }

  // P1-14 提交问卷：算标签 -> 更新 profile 画像 + 存答题记录（anonId，0 uid）
  async submitQuestionnaire(
    uid: string,
    type: string,
    answers: { questionId: string; optionId: string }[],
  ) {
    const t = type as QuestionnaireType;
    const bank = QUESTIONNAIRE_BANK[t];
    if (!bank) throw new BizException(30007, '问卷类型不存在');
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new BizException(30008, '答案不能为空');
    }

    // 累计标签权重
    const counter = new Map<string, number>();
    for (const a of answers) {
      const q = bank.questions.find((x) => x.id === a.questionId);
      if (!q) throw new BizException(30009, `题目不存在：${a.questionId}`);
      const opt = q.options.find((x) => x.id === a.optionId);
      if (!opt) throw new BizException(30009, `选项不存在：${a.optionId}`);
      for (const tag of opt.tags) {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      }
    }

    // 按权重排序取 top N
    const cfg = QUIZ_RESULT_CONFIG[t];
    const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const resultTags = sorted.slice(0, cfg.topN).map(([name]) => name);

    // 更新 profile 对应字段
    const profile = await this.getOrCreateProfile(uid);
    const updateData: Record<string, unknown> = {};
    if (cfg.field === 'moodState') {
      updateData.moodState = resultTags[0] ?? null;
    } else {
      // personality/interest：合并已有标签 + 新标签，去重，限 8 个
      const existing = (profile as unknown as Record<string, string[]>)[cfg.field] ?? [];
      const merged = [...new Set([...resultTags, ...existing])].slice(0, 8);
      updateData[cfg.field] = merged;
    }
    const updated = await this.prisma.anonymousProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    // 存答题记录（anonId，0 uid）
    await this.prisma.questionnaireAnswer.create({
      data: {
        anonId: profile.anonId,
        type: t,
        answers: answers,
        resultTags,
      },
    });

    return {
      type: t,
      resultTags,
      profile: this.toProfileVo(updated),
    };
  }

  // P0-12 匿名身份资料：find/create profile（用 access token/uid）
  private async getOrCreateProfile(uid: string) {
    let profile = await this.prisma.anonymousProfile.findUnique({ where: { userId: uid } });
    if (!profile) {
      profile = await this.prisma.anonymousProfile.create({
        data: {
          userId: uid,
          anonId: this.generateAnonId(),
          nickname: this.randomNickname(),
        },
      });
    } else if (this.isLegacyUnsafeAnonId(uid, profile.anonId)) {
      profile = await this.rotateUnsafeAnonId(profile.id, profile.anonId);
    }
    return profile;
  }

  async getProfile(uid: string): Promise<AnonProfileVo> {
    const profile = await this.getOrCreateProfile(uid);
    return this.toProfileVo(profile);
  }

  async updateProfile(uid: string, dto: UpdateAnonProfileDto): Promise<AnonProfileVo> {
    const profile = await this.getOrCreateProfile(uid);
    // P1-13：个性/兴趣/心情标签从 AnonTag 库校验（库为空时放行，兼容未 seed）
    if (dto.personalityTags !== undefined) {
      await this.assertTagsInLibrary('personality', dto.personalityTags);
    }
    if (dto.interestTags !== undefined) {
      await this.assertTagsInLibrary('interest', dto.interestTags);
    }
    if (dto.moodState !== undefined && dto.moodState) {
      await this.assertTagsInLibrary('mood', [dto.moodState]);
    }
    const updated = await this.prisma.anonymousProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
        ...(dto.personalityTags !== undefined ? { personalityTags: dto.personalityTags } : {}),
        ...(dto.interestTags !== undefined ? { interestTags: dto.interestTags } : {}),
        ...(dto.moodState !== undefined ? { moodState: dto.moodState } : {}),
      },
    });
    return this.toProfileVo(updated);
  }

  // P1-13 标签库：返回按 category 分组的 active 标签（公开，前端 chips 选择用）
  async listTags() {
    const tags = await this.prisma.anonTag.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, category: true, name: true, sortOrder: true },
    });
    const grouped: Record<string, { id: string; name: string; sortOrder: number }[]> = {
      personality: [],
      interest: [],
      mood: [],
    };
    for (const t of tags) {
      const g = grouped[t.category];
      if (g) g.push({ id: t.id, name: t.name, sortOrder: t.sortOrder });
    }
    return grouped;
  }

  // P1-13 校验传入标签名都在库中且 active；库为空时放行（兼容未 seed / 老数据）
  private async assertTagsInLibrary(category: string, names: string[]) {
    if (names.length === 0) return;
    const active = await this.prisma.anonTag.findMany({
      where: { category, active: true, name: { in: names } },
      select: { name: true },
    });
    const activeNames = new Set(active.map((t) => t.name));
    // 库里该 category 没有任何标签 -> 放行（兼容未 seed）
    if (active.length === 0) {
      const anyInCat = await this.prisma.anonTag.count({ where: { category } });
      if (anyInCat === 0) return;
    }
    const invalid = names.filter((n) => !activeNames.has(n));
    if (invalid.length > 0) {
      throw new BizException(30003, `标签不在可选范围：${invalid.join('、')}`);
    }
  }

  private toProfileVo(p: {
    nickname: string;
    avatar: string | null;
    personalityTags: string[];
    interestTags: string[];
    moodState: string | null;
  }): AnonProfileVo {
    return {
      nickname: p.nickname,
      avatar: p.avatar,
      personalityTags: p.personalityTags,
      interestTags: p.interestTags,
      moodState: p.moodState,
    };
  }

  async createPost(anonId: string, dto: CreateAnonPostDto) {
    await this.moderation.checkText(dto.content);
    for (const url of dto.images ?? []) {
      await this.moderation.checkImage(url);
    }
    // P1-13：发帖 mood 从标签库校验
    if (dto.mood) {
      await this.assertTagsInLibrary('mood', [dto.mood]);
    }
    const post = await this.prisma.anonymousPost.create({
      data: {
        anonId,
        content: dto.content,
        images: dto.images ?? [],
        mood: dto.mood ?? null,
        status: PostStatus.APPROVED,
      },
    });
    return this.toVo(post);
  }

  async listPosts(
    anonId: string,
    opts: { cursor?: string; limit?: number; sort?: 'latest' | 'recommend'; mood?: string } = {},
  ) {
    const limit = opts.limit ?? 20;
    const baseWhere: Prisma.AnonymousPostWhereInput = { status: PostStatus.APPROVED };
    if (opts.mood) baseWhere.mood = opts.mood;
    // P0-16 广场隔离：排除与当前用户互相屏蔽的对端帖子
    const blockedPeers = await this.getBlockedPeerSet(anonId);
    if (blockedPeers.size > 0) baseWhere.anonId = { notIn: [...blockedPeers] };

    // P0-13 推荐：热度（点赞）+ 新鲜度，take limit 不分页（规则排序，不接 AI）
    if (opts.sort === 'recommend') {
      const posts = await this.prisma.anonymousPost.findMany({
        where: baseWhere,
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: { likes: { where: { anonId }, select: { id: true }, take: 1 } },
      });
      return { list: posts.map((p) => this.toVo(p)), nextCursor: null, hasMore: false };
    }

    // 最新：按 createdAt 游标分页
    const where: Prisma.AnonymousPostWhereInput = { ...baseWhere };
    if (opts.cursor) {
      const t = new Date(opts.cursor);
      if (!Number.isNaN(t.getTime())) where.createdAt = { lt: t };
    }
    const posts = await this.prisma.anonymousPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { likes: { where: { anonId }, select: { id: true }, take: 1 } },
    });
    const hasMore = posts.length > limit;
    const slice = hasMore ? posts.slice(0, limit) : posts;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
    return { list: slice.map((p) => this.toVo(p)), nextCursor, hasMore };
  }

  // 我的匿名帖：按 userId -> anonId 查（用 access token，非 anon）
  async listMyAnonPosts(uid: string) {
    const profile = await this.prisma.anonymousProfile.findUnique({ where: { userId: uid } });
    if (!profile) return { list: [] };
    const posts = await this.prisma.anonymousPost.findMany({
      where: { anonId: profile.anonId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { list: posts.map((p) => this.toVo(p)) };
  }

  async getPost(anonId: string, id: string) {
    const post = await this.prisma.anonymousPost.findFirst({
      where: { id, status: PostStatus.APPROVED },
      include: { likes: { where: { anonId }, select: { id: true }, take: 1 } },
    });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    // P0-16 广场隔离：互相屏蔽则详情不可见
    if (await this.isBlockedEither(anonId, post.anonId)) {
      throw new BizException(30005, '内容不可见', HttpStatus.FORBIDDEN);
    }
    return this.toVo(post);
  }

  // 1v1 随机匹配：内存队列撮合 -> ChatMatch + IM 凭证（anonId 作 loginUserId）
  async match(anonId: string) {
    this.removeFromMatchQueue(anonId);
    const active = await this.findActiveMatch(anonId);
    if (active) {
      // P1-17 过期匹配自动关闭，继续走队列
      if (await this.expireIfStale(anonId, active)) {
        // 过期已 CLOSE，落入下方队列逻辑
      } else {
        const peerAnonId = active.anonIdA === anonId ? active.anonIdB : active.anonIdA;
        // P0-16 匹配隔离：屏蔽后残留的活跃匹配不返回，关闭并继续走队列
        if (await this.isBlockedEither(anonId, peerAnonId)) {
          await this.prisma.chatMatch.update({ where: { id: active.id }, data: { status: MatchStatus.CLOSED } });
        } else {
          const imCredential = await this.im.getImCredential(anonId);
          // P1-15 返回已有匹配度 + 命中标签 + peer 展示标签；P1-17 带 expireAt
          const peerTags = await this.getDisplayTags(peerAnonId);
          return {
            matchId: active.id,
            peerAnonId,
            imCredential,
            waiting: false,
            matchScore: active.matchScore ?? 0,
            matchedTags: active.matchedTags,
            peerTags,
            expireAt: active.expireAt ? active.expireAt.toISOString() : null,
          };
        }
      }
    }
    // P1-15 规则匹配：遍历队列所有候选，按标签重合度选最优
    const myTags = await this.getDisplayTags(anonId);
    let bestPeer: string | null = null;
    let bestScore = -1;
    let bestMatched: string[] = [];
    const skipped: string[] = [];
    while (this.matchQueue.length > 0) {
      const peer = this.matchQueue.shift()!;
      if (peer === anonId) continue;
      this.removeFromMatchQueue(peer);
      const peerActive = await this.findActiveMatch(peer);
      if (peerActive) continue;
      // P0-16 匹配隔离：互相屏蔽不撮合
      if (await this.isBlockedEither(anonId, peer)) continue;
      // P1-15 算重合度
      const peerTags = await this.getDisplayTags(peer);
      const { score, matched } = this.computeMatchScore(myTags, peerTags);
      if (score > bestScore) {
        // 之前的最优如果存在，放回队列尾部供后续匹配
        if (bestPeer !== null) this.matchQueue.push(bestPeer);
        bestPeer = peer;
        bestScore = score;
        bestMatched = matched;
      } else {
        // 不是最优，放回队列尾部
        this.matchQueue.push(peer);
      }
      skipped.push(peer);
    }
    if (bestPeer !== null) {
      const expireAt = new Date(Date.now() + MATCH_TTL_MS);
      const m = await this.prisma.chatMatch.create({
        data: {
          anonIdA: bestPeer,
          anonIdB: anonId,
          status: MatchStatus.ACTIVE,
          matchScore: bestScore,
          matchedTags: bestMatched,
          expireAt,
        },
      });
      const imCredential = await this.im.getImCredential(anonId);
      const peerTags = await this.getDisplayTags(bestPeer);
      return {
        matchId: m.id,
        peerAnonId: bestPeer,
        imCredential,
        waiting: false,
        matchScore: bestScore,
        matchedTags: bestMatched,
        peerTags,
        expireAt: expireAt.toISOString(),
      };
    }
    // 无可用对象，自己入队等待
    this.matchQueue.push(anonId);
    return { waiting: true };
  }

  // P1-15 取匿名画像展示标签（interestTags + personalityTags 合并，不含 uid）
  private async getDisplayTags(anonId: string): Promise<string[]> {
    const p = await this.prisma.anonymousProfile.findUnique({
      where: { anonId },
      select: { interestTags: true, personalityTags: true },
    });
    if (!p) return [];
    return [...new Set([...p.interestTags, ...p.personalityTags])];
  }

  // P1-15 规则匹配度：Jaccard 相似度（交集/并集 * 100）；并集为空时 0
  private computeMatchScore(tagsA: string[], tagsB: string[]): { score: number; matched: string[] } {
    const setA = new Set(tagsA);
    const setB = new Set(tagsB);
    const matched = [...setA].filter((t) => setB.has(t));
    const unionSize = new Set([...tagsA, ...tagsB]).size;
    const score = unionSize === 0 ? 0 : Math.round((matched.length / unionSize) * 100);
    return { score, matched };
  }

  // P1-16 匹配历史：当前用户的 ChatMatch 列表（含 peer 展示信息），按时间倒序分页
  async listMatches(anonId: string, page: number, pageSize: number) {
    const [matches, total] = await Promise.all([
      this.prisma.chatMatch.findMany({
        where: { OR: [{ anonIdA: anonId }, { anonIdB: anonId }] },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.chatMatch.count({ where: { OR: [{ anonIdA: anonId }, { anonIdB: anonId }] } }),
    ]);
    // 批量取 peer 的展示信息（nickname/avatar/tags）
    const peerIds = [...new Set(matches.map((m) => (m.anonIdA === anonId ? m.anonIdB : m.anonIdA)))];
    const peers = await this.prisma.anonymousProfile.findMany({
      where: { anonId: { in: peerIds } },
      select: { anonId: true, nickname: true, avatar: true, interestTags: true, personalityTags: true },
    });
    const peerMap = new Map(peers.map((p) => [p.anonId, p]));
    const list = matches.map((m) => {
      const peerAnonId = m.anonIdA === anonId ? m.anonIdB : m.anonIdA;
      const peer = peerMap.get(peerAnonId);
      return {
        id: m.id,
        peerAnonId,
        peerNickname: peer?.nickname ?? '匿名用户',
        peerAvatar: peer?.avatar ?? null,
        peerTags: peer ? [...new Set([...peer.interestTags, ...peer.personalityTags])] : [],
        matchScore: m.matchScore ?? 0,
        matchedTags: m.matchedTags,
        status: m.status,
        expireAt: m.expireAt ? m.expireAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      };
    });
    return { list, total, page, pageSize };
  }

  // P1-17 定时关闭过期活跃匹配（cron 调用；惰性关闭在 expireIfStale）
  async closeExpiredMatches() {
    const result = await this.prisma.chatMatch.updateMany({
      where: { status: MatchStatus.ACTIVE, expireAt: { lt: new Date() } },
      data: { status: MatchStatus.CLOSED },
    });
    return { closed: result.count };
  }

  // P1-16 跳过/不喜欢：关闭指定匹配（校验归属）+ 重新匹配返回新对象
  async skipMatch(anonId: string, matchId: string) {
    const m = await this.prisma.chatMatch.findUnique({ where: { id: matchId } });
    if (!m) throw new BizException(30010, '匹配不存在');
    if (m.anonIdA !== anonId && m.anonIdB !== anonId) {
      throw new BizException(10003, '无权操作此匹配');
    }
    // 关闭当前匹配
    if (m.status === MatchStatus.ACTIVE) {
      await this.prisma.chatMatch.update({ where: { id: matchId }, data: { status: MatchStatus.CLOSED } });
    }
    // 重新匹配（match 内部会先 removeFromMatchQueue + findActiveMatch，当前已关闭故走队列）
    return this.match(anonId);
  }

  // 派对房：返回房间号 + IM 凭证（客户端 ws join roomId 群聊）
  async joinParty(anonId: string) {
    const imCredential = await this.im.getImCredential(anonId);
    return { roomId: 'treehole-party-main', imCredential };
  }

  async sendMessage(anonId: string, peerAnonId: string, content: string, type?: string, duration?: number) {
    if (!peerAnonId || !content.trim()) {
      throw new BizException(30004, '消息内容无效', HttpStatus.BAD_REQUEST);
    }
    // P0-16 聊天隔离：互相屏蔽不可发消息（精确提示，覆盖 HTTP 主路径）
    if (await this.isBlockedEither(anonId, peerAnonId)) {
      throw new BizException(30005, '你已屏蔽对方或被对方屏蔽', HttpStatus.FORBIDDEN);
    }
    return this.chat.sendMessage(anonId, peerAnonId, content, type, duration);
  }

  async listMessages(anonId: string, peerAnonId: string, cursor?: string, limit = 50) {
    if (!peerAnonId) throw new BizException(30004, '消息对象无效', HttpStatus.BAD_REQUEST);
    return this.chat.listMessages(anonId, peerAnonId, cursor, limit);
  }

  // P0-16 屏蔽：A 屏蔽 B（按 anonId，幂等），并关闭两人活跃匹配（互相隔离·三处全隔离）
  async block(anonId: string, blockedAnonId: string) {
    if (!blockedAnonId || blockedAnonId === anonId) {
      throw new BizException(30004, '屏蔽对象无效', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.anonBlock.upsert({
      where: { blockerAnonId_blockedAnonId: { blockerAnonId: anonId, blockedAnonId } },
      update: {},
      create: { blockerAnonId: anonId, blockedAnonId },
    });
    // 关闭两人已有活跃匹配（双向），屏蔽后不可再聊
    await this.prisma.chatMatch.updateMany({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [
          { anonIdA: anonId, anonIdB: blockedAnonId },
          { anonIdA: blockedAnonId, anonIdB: anonId },
        ],
      },
      data: { status: MatchStatus.CLOSED },
    });
    return { blocked: true };
  }

  // P0-16 取消屏蔽（单向删 blocker=anonId 的记录；不存在忽略）
  async unblock(anonId: string, blockedAnonId: string) {
    if (!blockedAnonId) throw new BizException(30004, '屏蔽对象无效', HttpStatus.BAD_REQUEST);
    try {
      await this.prisma.anonBlock.delete({
        where: { blockerAnonId_blockedAnonId: { blockerAnonId: anonId, blockedAnonId } },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) throw e;
    }
    return { blocked: false };
  }

  // P0-16 我的屏蔽列表（仅 blocker=anonId，被屏蔽对端）
  async listBlocks(anonId: string) {
    const blocks = await this.prisma.anonBlock.findMany({
      where: { blockerAnonId: anonId },
      orderBy: { createdAt: 'desc' },
      select: { blockedAnonId: true, createdAt: true },
    });
    return {
      list: blocks.map((b) => ({ blockedAnonId: b.blockedAnonId, createdAt: b.createdAt.toISOString() })),
    };
  }

  // P0-16 双向屏蔽判断（A 屏蔽 B 或 B 屏蔽 A）-> 互相隔离
  private async isBlockedEither(a: string, b: string): Promise<boolean> {
    if (!a || !b || a === b) return false;
    const row = await this.prisma.anonBlock.findFirst({
      where: {
        OR: [
          { blockerAnonId: a, blockedAnonId: b },
          { blockerAnonId: b, blockedAnonId: a },
        ],
      },
      select: { id: true },
    });
    return !!row;
  }

  // P0-16 当前 anonId 的双向屏蔽对端集合（广场列表排除用，A 屏蔽 B 或 B 屏蔽 A 都排除 B）
  private async getBlockedPeerSet(anonId: string): Promise<Set<string>> {
    const rows = await this.prisma.anonBlock.findMany({
      where: { OR: [{ blockerAnonId: anonId }, { blockedAnonId: anonId }] },
      select: { blockerAnonId: true, blockedAnonId: true },
    });
    const set = new Set<string>();
    for (const r of rows) {
      if (r.blockerAnonId !== anonId) set.add(r.blockerAnonId);
      if (r.blockedAnonId !== anonId) set.add(r.blockedAnonId);
    }
    return set;
  }

  // 匿名点赞 toggle（去重/取消）
  async toggleAnonPostLike(anonId: string, postId: string) {
    const post = await this.prisma.anonymousPost.findUnique({ where: { id: postId } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    const existing = await this.prisma.anonPostLike.findUnique({
      where: { postId_anonId: { postId, anonId } },
    });
    if (existing) {
      try {
        await this.prisma.$transaction([
          this.prisma.anonPostLike.delete({ where: { id: existing.id } }),
          this.prisma.anonymousPost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
        ]);
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) throw e;
      }
      const after = await this.prisma.anonymousPost.findUnique({ where: { id: postId }, select: { likeCount: true } });
      const liked = await this.prisma.anonPostLike.findUnique({
        where: { postId_anonId: { postId, anonId } },
        select: { id: true },
      });
      return { liked: !!liked, likeCount: Math.max(0, after?.likeCount ?? post.likeCount - 1) };
    }
    try {
      await this.prisma.$transaction([
        this.prisma.anonPostLike.create({ data: { postId, anonId } }),
        this.prisma.anonymousPost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
      ]);
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    const after = await this.prisma.anonymousPost.findUnique({ where: { id: postId }, select: { likeCount: true } });
    const liked = await this.prisma.anonPostLike.findUnique({
      where: { postId_anonId: { postId, anonId } },
      select: { id: true },
    });
    return { liked: !!liked, likeCount: after?.likeCount ?? post.likeCount + 1 };
  }

  private randomNickname(): string {
    const a = NICK_A[Math.floor(Math.random() * NICK_A.length)];
    const b = NICK_B[Math.floor(Math.random() * NICK_B.length)];
    return `${a}${b}`;
  }

  private generateAnonId(): string {
    return `anon_${randomUUID().replace(/-/g, '')}`;
  }

  private removeFromMatchQueue(anonId: string): void {
    for (let i = this.matchQueue.length - 1; i >= 0; i -= 1) {
      if (this.matchQueue[i] === anonId) this.matchQueue.splice(i, 1);
    }
  }

  private findActiveMatch(anonId: string) {
    return this.prisma.chatMatch.findFirst({
      where: {
        status: MatchStatus.ACTIVE,
        OR: [{ anonIdA: anonId }, { anonIdB: anonId }],
      },
      select: { id: true, anonIdA: true, anonIdB: true, matchScore: true, matchedTags: true, expireAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // P1-17 检查活跃匹配是否过期；过期则 CLOSE 并返回 true（调用方当作无活跃匹配）
  private async expireIfStale(anonId: string, active: { id: string; expireAt: Date | null } | null): Promise<boolean> {
    if (!active || !active.expireAt) return false;
    if (active.expireAt.getTime() > Date.now()) return false;
    await this.prisma.chatMatch.update({ where: { id: active.id }, data: { status: MatchStatus.CLOSED } });
    return true;
  }

  private isLegacyUnsafeAnonId(uid: string, anonId: string): boolean {
    return anonId.startsWith(`anon_${uid.slice(-6)}_`);
  }

  private async rotateUnsafeAnonId(profileId: string, oldAnonId: string) {
    const nextAnonId = this.generateAnonId();
    const profile = await this.prisma.$transaction(async (tx) => {
      await tx.anonymousPost.updateMany({ where: { anonId: oldAnonId }, data: { anonId: nextAnonId } });
      await tx.anonPostLike.updateMany({ where: { anonId: oldAnonId }, data: { anonId: nextAnonId } });
      await tx.chatMatch.updateMany({ where: { anonIdA: oldAnonId }, data: { anonIdA: nextAnonId } });
      await tx.chatMatch.updateMany({ where: { anonIdB: oldAnonId }, data: { anonIdB: nextAnonId } });
      await tx.chatMessage.updateMany({ where: { fromId: oldAnonId }, data: { fromId: nextAnonId } });
      await tx.chatMessage.updateMany({ where: { toId: oldAnonId }, data: { toId: nextAnonId } });
      await tx.chatSession.updateMany({ where: { ownerId: oldAnonId }, data: { ownerId: nextAnonId } });
      await tx.chatSession.updateMany({ where: { peerId: oldAnonId }, data: { peerId: nextAnonId } });
      return tx.anonymousProfile.update({
        where: { id: profileId },
        data: { anonId: nextAnonId },
      });
    });
    this.logger.warn(`rotated legacy unsafe anonId for profile ${profileId}`);
    return profile;
  }

  private toVo(p: {
    id: string;
    anonId: string;
    content: string;
    images: string[];
    mood: string | null;
    status: PostStatus;
    likeCount: number;
    createdAt: Date;
    likes?: { id: string }[];
  }) {
    return {
      id: p.id,
      anonId: p.anonId,
      content: p.content,
      images: p.images,
      mood: p.mood,
      likeCount: p.likeCount,
      liked: (p.likes?.length ?? 0) > 0,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
