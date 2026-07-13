import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MatchStatus, PostStatus, Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { ImService } from '../chat/im.service';
import type { CreateAnonPostDto } from './dto/create-anon-post.dto';

// 错误码 3xxxx 树洞段（API §3）：30001 匿名态失效 / 30002 匹配无可用对象
const NICK_A = ['星河', '南门', '月光', '晚风', '深海', '森林', '云端', '陌路', '拾光', '孤岛'];
const NICK_B = ['边的猫', '第二棵树', '漫游者', '低语者', '失眠人', '观察者', '拾星人', '夜行人'];

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
  ) {}

  // 换匿名 token：find/create AnonymousProfile（userId->anonId，后台可追溯），签 anonToken（含 anonId，不含 uid）
  async getAnonymousToken(uid: string) {
    let profile = await this.prisma.anonymousProfile.findUnique({ where: { userId: uid } });
    if (!profile) {
      profile = await this.prisma.anonymousProfile.create({
        data: {
          userId: uid,
          anonId: `anon_${uid.slice(-6)}_${Date.now().toString(36)}`,
          nickname: this.randomNickname(),
        },
      });
    }
    const anonToken = await this.jwt.signAsync(
      { anonId: profile.anonId, type: 'anon' },
      { expiresIn: '7d' },
    );
    return { anonId: profile.anonId, anonToken, nickname: profile.nickname };
  }

  async createPost(anonId: string, dto: CreateAnonPostDto) {
    await this.moderation.checkText(dto.content);
    for (const url of dto.images ?? []) {
      await this.moderation.checkImage(url);
    }
    const post = await this.prisma.anonymousPost.create({
      data: {
        anonId,
        content: dto.content,
        images: dto.images ?? [],
        status: PostStatus.APPROVED,
      },
    });
    return this.toVo(post);
  }

  async listPosts(anonId: string, cursor?: string, limit = 20) {
    const where: Prisma.AnonymousPostWhereInput = { status: PostStatus.APPROVED };
    if (cursor) {
      const t = new Date(cursor);
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

  // 1v1 随机匹配：内存队列撮合 -> ChatMatch + IM 凭证（anonId 作 loginUserId）
  async match(anonId: string) {
    while (this.matchQueue.length > 0) {
      const peer = this.matchQueue.shift()!;
      if (peer !== anonId) {
        const m = await this.prisma.chatMatch.create({
          data: { anonIdA: peer, anonIdB: anonId, status: MatchStatus.ACTIVE },
        });
        const imCredential = await this.im.getImCredential(anonId);
        return { matchId: m.id, peerAnonId: peer, imCredential, waiting: false };
      }
    }
    // 无可用对象，自己入队等待
    this.matchQueue.push(anonId);
    return { waiting: true };
  }

  // 派对房：返回房间号 + IM 凭证（客户端 ws join roomId 群聊）
  async joinParty(anonId: string) {
    const imCredential = await this.im.getImCredential(anonId);
    return { roomId: 'treehole-party-main', imCredential };
  }

  // 匿名点赞 toggle（去重/取消）
  async toggleAnonPostLike(anonId: string, postId: string) {
    const post = await this.prisma.anonymousPost.findUnique({ where: { id: postId } });
    if (!post) throw new BizException(40001, '帖子不存在', HttpStatus.NOT_FOUND);
    const existing = await this.prisma.anonPostLike.findUnique({
      where: { postId_anonId: { postId, anonId } },
    });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.anonPostLike.delete({ where: { id: existing.id } }),
        this.prisma.anonymousPost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return { liked: false, likeCount: Math.max(0, post.likeCount - 1) };
    }
    await this.prisma.$transaction([
      this.prisma.anonPostLike.create({ data: { postId, anonId } }),
      this.prisma.anonymousPost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
    ]);
    return { liked: true, likeCount: post.likeCount + 1 };
  }

  private randomNickname(): string {
    const a = NICK_A[Math.floor(Math.random() * NICK_A.length)];
    const b = NICK_B[Math.floor(Math.random() * NICK_B.length)];
    return `${a}${b}`;
  }

  private toVo(p: {
    id: string;
    anonId: string;
    content: string;
    images: string[];
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
      likeCount: p.likeCount,
      liked: (p.likes?.length ?? 0) > 0,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
