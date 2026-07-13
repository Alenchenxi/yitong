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

// 游标 = base64url(createdAtIso | id)，用于 (createdAt DESC, id DESC) 的稳定分页
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.indexOf('|');
    if (sep < 0) return null;
    const iso = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
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

  async createPost(
    uid: string,
    openid: string,
    circleId: string,
    dto: CreatePostDto,
  ): Promise<PostVo> {
    const circle = await this.prisma.circle.findUnique({ where: { id: circleId } });
    if (!circle) throw new BizException(20001, '圈子不存在');

    // 发帖前内联内容安全：文本 + 每张图（与 API 规范 §10 对齐）
    await this.moderation.checkText(dto.content, openid);
    for (const url of dto.images ?? []) {
      await this.moderation.checkImage(url);
    }

    // 内容安全通过即发布（APPROVED）；PENDING 留给 review 命中 / 管理端审核队列
    const post = await this.prisma.post.create({
      data: {
        circleId,
        authorId: uid,
        content: dto.content,
        images: dto.images ?? [],
        status: PostStatus.APPROVED,
      },
      include: postInclude(uid),
    });
    return this.toPostVo(post);
  }

  async feed(uid: string, query: FeedQueryDto): Promise<FeedResult> {
    return this.queryPosts(uid, query, undefined);
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
      await this.prisma.$transaction([
        this.prisma.postLike.delete({ where: { id: existing.id } }),
        this.prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      const after = await this.prisma.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: Math.max(0, after?.likeCount ?? 0) };
    }

    await this.prisma.$transaction([
      this.prisma.postLike.create({ data: { postId, userId: uid } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    const after = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: after?.likeCount ?? 0 };
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

  private toPostVo(post: PostWithAuthor): PostVo {
    return {
      id: post.id,
      circleId: post.circleId,
      authorId: post.authorId,
      authorNickname: post.author.nickname,
      authorAvatarUrl: post.author.avatarUrl,
      content: post.content,
      images: post.images,
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
