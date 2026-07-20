import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, PostStatus } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import type {
  CommentVo,
  FeedResult,
  LikeResult,
  PageResult,
  PostVo,
} from './types';

// 帖子查询的关联加载：作者信息 + 评论数 + 当前用户是否已赞
function postInclude(uid: string) {
  return {
    author: { select: { id: true, nickname: true, avatarUrl: true } },
    _count: { select: { comments: true } },
    postLikes: { where: { userId: uid }, select: { id: true }, take: 1 },
  } as const;
}
type PostWithAuthor = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

// 首页发现流缓存：5 分钟 TTL，减少高并发下重复查询
interface CacheEntry {
  data: FeedResult;
  expiresAt: number;
}
const feedCache = new Map<string, CacheEntry>();
const FEED_CACHE_TTL_MS = 5 * 60 * 1000;

function invalidateFeedCache() {
  feedCache.clear();
}

function feedCacheKey(uid: string, limit: number, sort: string): string {
  return `${uid}:${limit}:${sort}`;
}

// 游标 = base64url JSON { t: createdAtIso, id }，用于 (createdAt DESC, id DESC) 的稳定分页
function encodeCursor(createdAt: Date, id: string): string {
  const payload = JSON.stringify({ t: createdAt.toISOString(), id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.indexOf('|');
    if (sep > 0) {
      const createdAt = new Date(raw.slice(0, sep));
      const id = raw.slice(sep + 1);
      if (Number.isNaN(createdAt.getTime()) || !id) return null;
      return { createdAt, id };
    }
    const parsed = JSON.parse(raw) as { t?: string; id?: string };
    if (!parsed.t || !parsed.id) return null;
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

// 匿名展示昵称：词库随机组合，每帖独立、不可跨帖关联（真实 uid 仅后台按 authorId 追溯）
const ANON_ADJ = ['浪漫的', '勇敢的', '温柔的', '神秘的', '倔强的', '安静的', '闪闪的', '路过的'];
const ANON_NOUN = ['同学', '小可爱', '过客', '星辰', '树', '风', '月亮', '旅人'];
function generateAnonName(): string {
  const adj = ANON_ADJ[Math.floor(Math.random() * ANON_ADJ.length)] ?? '神秘的';
  const noun = ANON_NOUN[Math.floor(Math.random() * ANON_NOUN.length)] ?? '过客';
  return `${adj}${noun}`;
}

@Injectable()
export class ConfessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  listCircles() {
    return this.prisma.circle.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, icon: true },
    });
  }

  invalidateFeedCache() {
    invalidateFeedCache();
  }

  async createPost(
    uid: string,
    openid: string,
    circleId: string,
    dto: CreatePostDto,
  ): Promise<PostVo> {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) throw new BizException(20001, '圈子不存在');

    // 发帖前内联内容安全：文本 + 每张图 + 视频封面（与 API 规范 §10 / 功能规划 §1.7 对齐）
    await this.moderation.checkText(dto.content, openid);
    for (const url of dto.images ?? []) {
      await this.moderation.checkImage(url);
    }
    if (dto.videoCover) {
      await this.moderation.checkImage(dto.videoCover);
    }
    // 视频完整审核：微信侧 mediaCheckAsync 需回调链路，P0 走 stub（fail-open + warn），P3-06 补全
    if (dto.videoUrl) {
      this.moderation.checkVideoStub(dto.videoUrl);
    }

    const isAnonymous = !!dto.isAnonymous;

    // 内容安全通过即发布（APPROVED）；PENDING 留给 review 命中 / 管理端审核队列
    const post = await this.prisma.post.create({
      data: {
        circleId,
        authorId: uid,
        content: dto.content,
        images: dto.images ?? [],
        tags: dto.tags ?? [],
        isAnonymous,
        anonName: isAnonymous ? generateAnonName() : null,
        videoUrl: dto.videoUrl ?? null,
        videoCover: dto.videoCover ?? null,
        status: PostStatus.APPROVED,
      },
      include: postInclude(uid),
    });
    invalidateFeedCache();
    return this.toPostVo(post);
  }

  async feed(uid: string, query: FeedQueryDto): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'latest';
    const cacheKey = feedCacheKey(uid, limit, sort);
    // 仅首页（无 cursor）发现流走 5 分钟内存缓存；按用户+sort 分桶，避免 liked 状态串用
    if (!query.cursor && limit <= 20) {
      const cached = feedCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
    }
    const result = sort === 'latest'
      ? await this.queryPosts(uid, query, undefined)
      : sort === 'follow'
        ? await this.queryFollowPosts(uid, query)
        : await this.queryHotPosts(uid, query, undefined, sort);
    if (!query.cursor && limit <= 20) {
      feedCache.set(cacheKey, { data: result, expiresAt: Date.now() + FEED_CACHE_TTL_MS });
    }
    return result;
  }

  async listCirclePosts(
    uid: string,
    circleId: string,
    query: FeedQueryDto,
  ): Promise<FeedResult> {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) throw new BizException(20001, '圈子不存在');
    return this.queryPosts(uid, query, circleId);
  }

  // 我的表白墙：当前用户发的帖（全部状态，含已下架）
  async listMyPosts(uid: string): Promise<{ list: PostVo[] }> {
    const posts = await this.prisma.post.findMany({
      where: { authorId: uid },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: postInclude(uid),
    });
    return { list: posts.map((p) => this.toPostVo(p)) };
  }

  async getPost(uid: string, id: string): Promise<PostVo> {
    const post = await this.prisma.post.findFirst({
      where: { id, status: PostStatus.APPROVED },
      include: postInclude(uid),
    });
    if (!post) throw new BizException(20003, '帖子不存在');
    return this.toPostVo(post);
  }

  async toggleLike(uid: string, postId: string): Promise<LikeResult> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) throw new BizException(20003, '帖子不存在');

    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: uid } },
    });
    if (existing) {
      try {
        await this.prisma.$transaction([
          this.prisma.postLike.delete({ where: { id: existing.id } }),
          this.prisma.post.update({
            where: { id: postId },
            data: { likeCount: { decrement: 1 } },
          }),
        ]);
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) throw e;
      }
      const after = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      });
      const liked = await this.prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId: uid } },
        select: { id: true },
      });
      invalidateFeedCache();
      return { liked: !!liked, likeCount: Math.max(0, after?.likeCount ?? 0) };
    }

    try {
      await this.prisma.$transaction([
        this.prisma.postLike.create({ data: { postId, userId: uid } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
    const after = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    });
    const liked = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: uid } },
      select: { id: true },
    });
    invalidateFeedCache();
    return { liked: !!liked, likeCount: after?.likeCount ?? 0 };
  }

  async createComment(
    uid: string,
    openid: string,
    postId: string,
    dto: CreateCommentDto,
  ): Promise<CommentVo> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: PostStatus.APPROVED },
      select: { id: true },
    });
    if (!post) throw new BizException(20003, '帖子不存在');

    await this.moderation.checkText(dto.content, openid);
    const comment = await this.prisma.comment.create({
      data: { postId, authorId: uid, content: dto.content },
      include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
    });
    invalidateFeedCache();
    return this.toCommentVo(comment);
  }

  async listComments(
    postId: string,
    page: number,
    pageSize: number,
  ): Promise<PageResult<CommentVo>> {
    const [list, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: { select: { id: true, nickname: true, avatarUrl: true } } },
      }),
      this.prisma.comment.count({ where: { postId } }),
    ]);
    return { list: list.map((c) => this.toCommentVo(c)), total, page, pageSize };
  }

  // 举报帖子 -> 创建 ModerationRecord（管理员在审核队列可见）
  async reportPost(uid: string, postId: string, reason?: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new BizException(20003, '帖子不存在', HttpStatus.NOT_FOUND);
    await this.prisma.moderationRecord.create({
      data: {
        targetType: 'post',
        targetId: postId,
        reason: reason ?? '用户举报',
      },
    });
    return { reported: true };
  }

  private async queryPosts(
    uid: string,
    query: FeedQueryDto,
    circleId: string | undefined,
  ): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const where: Prisma.PostWhereInput = { status: PostStatus.APPROVED };
    if (circleId) where.circleId = circleId;
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } },
      ];
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: postInclude(uid),
    });

    const hasMore = posts.length > limit;
    const slice = hasMore ? posts.slice(0, limit) : posts;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    return { list: slice.map((p) => this.toPostVo(p)), nextCursor, hasMore };
  }

  // 热度排序（hot/recommend）：按点赞/评论数排序，首页 take limit，不分页
  private async queryHotPosts(
    uid: string,
    query: FeedQueryDto,
    circleId: string | undefined,
    sort: 'hot' | 'recommend',
  ): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const posts = await this.prisma.post.findMany({
      where: { status: PostStatus.APPROVED, ...(circleId ? { circleId } : {}) },
      orderBy:
        sort === 'hot'
          ? [{ likeCount: 'desc' }, { comments: { _count: 'desc' } }, { createdAt: 'desc' }]
          : [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: postInclude(uid),
    });
    return { list: posts.map((p) => this.toPostVo(p)), nextCursor: null, hasMore: false };
  }

  // 关注流：只看关注作者的最新帖
  private async queryFollowPosts(uid: string, query: FeedQueryDto): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const follows = await this.prisma.follow.findMany({
      where: { followerId: uid },
      select: { followeeId: true },
    });
    const followeeIds = follows.map((f) => f.followeeId);
    if (followeeIds.length === 0) return { list: [], nextCursor: null, hasMore: false };
    const posts = await this.prisma.post.findMany({
      where: { status: PostStatus.APPROVED, authorId: { in: followeeIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: postInclude(uid),
    });
    return { list: posts.map((p) => this.toPostVo(p)), nextCursor: null, hasMore: false };
  }

  private toPostVo(post: PostWithAuthor): PostVo {
    const isAnonymous = post.isAnonymous;
    return {
      id: post.id,
      circleId: post.circleId,
      // 匿名帖脱敏：不向客户端暴露真实 uid/昵称/头像（后台仍可按 authorId 追溯，见 listMyPosts）
      authorId: isAnonymous ? '' : post.authorId,
      authorNickname: isAnonymous
        ? (post.anonName ?? '匿名用户')
        : post.author.nickname,
      authorAvatarUrl: isAnonymous ? null : post.author.avatarUrl,
      content: post.content,
      images: post.images,
      tags: post.tags,
      isAnonymous,
      videoUrl: post.videoUrl,
      videoCover: post.videoCover,
      likeCount: post.likeCount,
      liked: post.postLikes.length > 0,
      commentCount: post._count.comments,
      createdAt: post.createdAt.toISOString(),
    };
  }

  private toCommentVo(
    comment: Prisma.CommentGetPayload<{
      include: { author: { select: { id: true; nickname: true; avatarUrl: true } } };
    }>,
  ): CommentVo {
    return {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorNickname: comment.author.nickname,
      authorAvatarUrl: comment.author.avatarUrl,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
