import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CommunityStatus, Prisma, PostStatus } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationService, NotificationType } from '../notification/notification.service';
import { CommunityService } from '../community/community.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import type {
  ActivityTopicVo,
  CommentVo,
  FeedResult,
  LikeResult,
  LocateResult,
  PageResult,
  PostVo,
  TopicVo,
} from './types';

// 帖子查询的关联加载：作者信息 + 评论数 + 当前用户是否已赞
function postInclude(uid: string) {
  return {
    author: { select: { id: true, nickname: true, avatarUrl: true } },
    _count: { select: { comments: true } },
    postLikes: { where: { userId: uid }, select: { id: true }, take: 1 },
  } as const;
}
type PostWithAuthor = Prisma.PostGetPayload<{
  include: ReturnType<typeof postInclude>;
}> & { visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT' };

// P0-10 评论 include：author + replyToUser（被回复用户昵称，用于"回复@user"展示）
const commentAuthorSelect = { id: true, nickname: true, avatarUrl: true } as const;
const replyToUserSelect = { select: { nickname: true } } as const;
// P1-01 回复预览条数：顶级评论列表每条只带前 3 条回复，更多走 /replies 分页
const REPLY_PREVIEW_SIZE = 3;
// P1-01 顶级评论 include：author + replyToUser + 回复预览（前 3 条，时间升序）+ 回复总数 + 当前用户是否赞
const topLevelCommentInclude = (uid: string) =>
  ({
    author: { select: commentAuthorSelect },
    replyToUser: replyToUserSelect,
    replies: {
      orderBy: { createdAt: 'asc' },
      take: REPLY_PREVIEW_SIZE,
      include: {
        author: { select: commentAuthorSelect },
        replyToUser: replyToUserSelect,
        likes: { where: { userId: uid }, select: { id: true }, take: 1 },
      },
    },
    likes: { where: { userId: uid }, select: { id: true }, take: 1 },
    _count: { select: { replies: true } },
  }) as const;

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

function feedCacheKey(uid: string, limit: number, sort: string, communityId?: string): string {
  return `${uid}:${limit}:${sort}:${communityId ?? 'all'}`;
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

// P1-03 @用户：解析 content 中的 @昵称（中文/英文/数字/下划线，1-20 字符）
const AT_RE = /@([一-龥A-Za-z0-9_]{1,20})/g;
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
  private readonly logger = new Logger(ConfessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly notification: NotificationService,
    private readonly community: CommunityService,
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

    // P1-11 草稿和私密投稿不进入公开审核流：跳过内容安全 + 直接 APPROVED；前台/feed 仅作者可见
    let visibility = dto.visibility ?? 'PUBLIC';
    // P2-06 定时发布：publishAt 未来时间 -> 暂存为 DRAFT，到点由 cron 转 PUBLIC + 审核
    let publishAt: Date | null = null;
    if (dto.publishAt) {
      const t = new Date(dto.publishAt);
      if (Number.isNaN(t.getTime())) {
        throw new BizException(20003, '定时发布时间格式无效', HttpStatus.BAD_REQUEST);
      }
      if (t.getTime() <= Date.now()) {
        throw new BizException(20003, '定时发布时间必须晚于当前时间', HttpStatus.BAD_REQUEST);
      }
      if (visibility === 'PRIVATE') {
        throw new BizException(20003, '私密投稿不支持定时发布', HttpStatus.BAD_REQUEST);
      }
      publishAt = t;
      visibility = 'DRAFT'; // 暂存草稿，到点转公开
    }
    const isScheduled = !!publishAt;
    const isDraftOrPrivate = visibility !== 'PUBLIC';

    if (!isDraftOrPrivate) {
      await this.moderation.checkText(dto.content, openid);
      for (const url of dto.images ?? []) {
        await this.moderation.checkImage(url);
      }
      if (dto.videoCover) {
        await this.moderation.checkImage(dto.videoCover);
      }
      if (dto.videoUrl) {
        this.moderation.checkVideoStub(dto.videoUrl);
      }
    }

    const isAnonymous = !!dto.isAnonymous && !isDraftOrPrivate; // 匿名仅用于公开发布

    // 圈子：发帖归属当前圈子（单真相源 = active community）+ 动态数 postCount++
    const communityId = await this.community.getActiveCommunityId(uid);
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          circleId,
          communityId,
          authorId: uid,
          content: dto.content,
          images: dto.images ?? [],
          tags: dto.tags ?? [],
          isAnonymous,
          anonName: isAnonymous ? generateAnonName() : null,
          videoUrl: dto.videoUrl ?? null,
          videoCover: dto.videoCover ?? null,
          status: PostStatus.APPROVED,
          visibility,
          publishAt,
        },
        include: postInclude(uid),
      });
      await tx.community.update({
        where: { id: communityId },
        data: { postCount: { increment: 1 } },
      });
      return created;
    });
    if (!isScheduled) invalidateFeedCache();
    return this.toPostVo(post);
  }

  async feed(uid: string, query: FeedQueryDto): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'latest';
    const communityId = query.communityId;
    const cacheKey = feedCacheKey(uid, limit, sort, communityId);
    // 仅首页（无 cursor）发现流走 5 分钟内存缓存；按用户+sort+圈子 分桶，避免 liked 状态串用
    if (!query.cursor && limit <= 20) {
      const cached = feedCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
    }
    const result = sort === 'latest'
      ? await this.queryPosts(uid, query, undefined, communityId)
      : sort === 'follow'
        ? await this.queryFollowPosts(uid, query)
        : await this.queryHotPosts(uid, query, undefined, communityId, sort);
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

  // 我的表白墙：当前用户发的帖（含已软删，但不影响展示；用户可看到「我删了的帖」以便复盘）
  async listMyPosts(uid: string): Promise<{ list: PostVo[] }> {
    const posts = await this.prisma.post.findMany({
      where: { authorId: uid },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: postInclude(uid),
    });
    return { list: posts.map((p) => this.toPostVo(p)) };
  }

  // P1-08 我点赞的帖（按点赞时间倒序分页，仅 APPROVED + 公开 且未软删）
  async listMyLikedPosts(uid: string, page: number, pageSize: number): Promise<PageResult<PostVo>> {
    const [likes, total] = await Promise.all([
      this.prisma.postLike.findMany({
        where: { userId: uid, post: { status: PostStatus.APPROVED, deletedAt: null, visibility: 'PUBLIC' } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { post: { include: postInclude(uid) } },
      }),
      this.prisma.postLike.count({ where: { userId: uid, post: { status: PostStatus.APPROVED, deletedAt: null, visibility: 'PUBLIC' } } }),
    ]);
    const list = likes.map((l) => this.toPostVo(l.post));
    return { list, total, page, pageSize };
  }

  // P1-11 我指定 visibility 的帖子（草稿/私密）
  async listMyByVisibility(uid: string, visibility: 'DRAFT' | 'PRIVATE', page: number, pageSize: number): Promise<PageResult<PostVo>> {
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { authorId: uid, visibility, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: postInclude(uid),
      }),
      this.prisma.post.count({ where: { authorId: uid, visibility, deletedAt: null } }),
    ]);
    return {
      list: posts.map((p) => this.toPostVo(p)),
      total,
      page,
      pageSize,
    };
  }

  // P1-08 我评论过的帖（按最后评论时间倒序去重分页；只展示 APPROVED 帖）
  async listMyCommentedPosts(uid: string, page: number, pageSize: number): Promise<PageResult<PostVo>> {
    // 先聚合：查评论里我评论过的 postId + 该帖评论 max(createdAt)
    const grouped = await this.prisma.comment.groupBy({
      by: ['postId'],
      where: { authorId: uid },
      _max: { createdAt: true },
    });
    const postIds = grouped.map((g) => g.postId);
    if (postIds.length === 0) return { list: [], total: 0, page, pageSize };
    const lastByPost = new Map<string, Date>();
    for (const g of grouped) {
      const t = g._max.createdAt;
      if (t) lastByPost.set(g.postId, t);
    }
    // 按 last comment 时间倒序排 postIds
    postIds.sort((a, b) => {
      const ta = lastByPost.get(a)?.getTime() ?? 0;
      const tb = lastByPost.get(b)?.getTime() ?? 0;
      return tb - ta;
    });
    // 分页
    const slice = postIds.slice((page - 1) * pageSize, page * pageSize);
    if (slice.length === 0) return { list: [], total: postIds.length, page, pageSize };
    const posts = await this.prisma.post.findMany({
      where: { id: { in: slice }, status: PostStatus.APPROVED, deletedAt: null, visibility: 'PUBLIC' },
      include: postInclude(uid),
    });
    // 保持排序：按 last comment desc
    const byId = new Map(posts.map((p) => [p.id, p]));
    const list = slice.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => this.toPostVo(p));
    return { list, total: postIds.length, page, pageSize };
  }

  async getPost(uid: string, id: string): Promise<PostVo> {
    // P1-11：作者可读自己的 DRAFT/PRIVATE；他人只看 PUBLIC 且 status=APPROVED
    const post = await this.prisma.post.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { status: PostStatus.APPROVED, visibility: 'PUBLIC' },
          { authorId: uid }, // 作者自己可见所有状态
        ],
      },
      include: postInclude(uid),
    });
    if (!post) throw new BizException(20003, '帖子不存在');
    // 圈子：浏览量埋点（ContentView 去重，fire-and-forget；今日上头 = 近24h 聚合）
    this.community.recordContentView('post', id, uid).catch(() => undefined);
    return this.toPostVo(post);
  }

  // P1-10 帖子编辑（仅作者；过内容安全；status 保持 APPROVED；UPDATE editedAt）
  async editPost(uid: string, postId: string, openid: string, dto: CreatePostDto): Promise<PostVo> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true, isAnonymous: true, anonName: true },
    });
    if (!post) throw new BizException(20003, '帖子不存在', HttpStatus.NOT_FOUND);
    if (post.authorId !== uid) throw new BizException(10003, '只有作者可编辑', HttpStatus.FORBIDDEN);

    // P1-10 编辑仍走内容安全 + 图片/视频审核
    await this.moderation.checkText(dto.content, openid);
    for (const url of dto.images ?? []) await this.moderation.checkImage(url);
    if (dto.videoCover) await this.moderation.checkImage(dto.videoCover);
    if (dto.videoUrl) this.moderation.checkVideoStub(dto.videoUrl);

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        content: dto.content,
        images: dto.images ?? [],
        tags: dto.tags ?? [],
        videoUrl: dto.videoUrl ?? null,
        videoCover: dto.videoCover ?? null,
        // P1-11：编辑可改 visibility（例：草稿保存后发布；私密改公开）
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
        editedAt: new Date(),
      },
      include: postInclude(uid),
    });
    invalidateFeedCache();
    return this.toPostVo(updated);
  }

  // P1-10 帖子软删（仅作者；deletedAt=now；listMyPosts 仍可见；getPost/listFeed/getCircle 不可见）
  async deletePost(uid: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { id: true, authorId: true, communityId: true },
    });
    if (!post) throw new BizException(20003, '帖子不存在', HttpStatus.NOT_FOUND);
    if (post.authorId !== uid) throw new BizException(10003, '只有作者可删除', HttpStatus.FORBIDDEN);
    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
    // 圈子动态数 postCount--（best-effort）
    if (post.communityId) {
      this.prisma.community
        .update({ where: { id: post.communityId }, data: { postCount: { decrement: 1 } } })
        .catch(() => undefined);
    }
    invalidateFeedCache();
    return { deleted: true };
  }

  async toggleLike(uid: string, postId: string): Promise<LikeResult> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
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
    // P0-11 赞通知（不通知自己；取消赞不通知）
    if (liked && post.authorId !== uid) {
      void this.notification
        .createFromActor({
          actorUid: uid,
          targetUid: post.authorId,
          type: NotificationType.POST_LIKE,
          title: '表白墙 · 新点赞',
          content: (a) => `${a} 赞了你的帖子`,
          targetType: 'post',
          targetId: postId,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify like failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
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
      select: { id: true, authorId: true },
    });
    if (!post) throw new BizException(20003, '帖子不存在');

    await this.moderation.checkText(dto.content, openid);

    // P0-10 回复：parentId 必须指向同帖顶级评论；replyToId 指向被回复的具体评论/回复（取其 author 存 replyToUserId）
    let parentId: string | null = null;
    let replyToUserId: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: dto.parentId, postId },
        select: { id: true, parentId: true, authorId: true },
      });
      if (!parent) throw new BizException(20005, '评论不存在');
      if (parent.parentId !== null) throw new BizException(20005, '只能回复顶级评论');
      parentId = parent.id;
      const replyToId = dto.replyToId ?? parent.id;
      const replyTarget = await this.prisma.comment.findFirst({
        where: { id: replyToId, postId },
        select: { authorId: true },
      });
      if (!replyTarget) throw new BizException(20005, '被回复的评论不存在');
      replyToUserId = replyTarget.authorId;
    }

    const comment = await this.prisma.comment.create({
      data: { postId, authorId: uid, content: dto.content, parentId, replyToUserId },
      include: {
        author: { select: commentAuthorSelect },
        replyToUser: replyToUserSelect,
      },
    });
    invalidateFeedCache();
    // P0-11 表白墙来源化消息：回复通知被回复用户；顶级评论通知帖子作者（均不通知自己）
    // P1-01 extraId=commentId：通知点击跳转详情页后定位到具体评论/回复
    if (parentId && replyToUserId) {
      void this.notification
        .createFromActor({
          actorUid: uid,
          targetUid: replyToUserId,
          type: NotificationType.COMMENT_REPLY,
          title: '表白墙 · 新回复',
          content: (a) => `${a} 回复了你的评论`,
          targetType: 'post',
          targetId: postId,
          extraId: comment.id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify reply failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    } else if (!parentId) {
      void this.notification
        .createFromActor({
          actorUid: uid,
          targetUid: post.authorId,
          type: NotificationType.POST_COMMENT,
          title: '表白墙 · 新评论',
          content: (a) => `${a} 评论了你的帖子`,
          targetType: 'post',
          targetId: postId,
          extraId: comment.id,
        })
        .catch((e: unknown) =>
          this.logger.warn(`notify comment failed: ${e instanceof Error ? e.message : String(e)}`),
        );
    }
    // P1-03 @用户通知：解析 @昵称（去重、不通知自己） → 异步发送
    void this.notifyMentions(uid, comment).catch((e: unknown) =>
      this.logger.warn(`notify mention failed: ${e instanceof Error ? e.message : String(e)}`),
    );

    return this.toCommentVo(comment);
  }

  // P1-03 解析评论 content 中 @昵称 -> 发送 mention 通知
  private async notifyMentions(actorUid: string, comment: {
    id: string;
    postId: string;
    content: string;
  }) {
    const set = new Set<string>();
    for (const m of comment.content.matchAll(AT_RE)) {
      const nick = m[1];
      if (nick) set.add(nick);
    }
    if (set.size === 0) return;
    const targets = await this.prisma.user.findMany({
      where: { nickname: { in: [...set] }, deletedAt: null },
      select: { id: true, nickname: true },
    });
    for (const u of targets) {
      if (u.id === actorUid) continue; // 不通知自己
      void this.notification
        .createFromActor({
          actorUid,
          targetUid: u.id,
          type: NotificationType.COMMENT_MENTION,
          title: '表白墙 · @了你',
          content: (a) => `${a} 在评论中提到了你`,
          targetType: 'post',
          targetId: comment.postId,
          extraId: comment.id,
        })
        .catch(() => undefined);
    }
  }

  async listComments(
    uid: string,
    postId: string,
    page: number,
    pageSize: number,
  ): Promise<PageResult<CommentVo>> {
    const [topLevel, total, pinned] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId, parentId: null },
        // P1-04 置顶优先，再按热度（likeCount desc + 回复数 desc + 时间 desc）
        orderBy: [
          { pinned: 'desc' },
          { likeCount: 'desc' },
          { replies: { _count: 'desc' } },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: topLevelCommentInclude(uid),
      }),
      this.prisma.comment.count({ where: { postId, parentId: null } }),
      // P1-04：第一页额外附置顶评论（即使不在分页结果里也展示在置顶区）
      page === 1
        ? this.prisma.comment.findMany({
            where: { postId, parentId: null, pinned: true },
            orderBy: { likeCount: 'desc' },
            include: topLevelCommentInclude(uid),
          })
        : Promise.resolve([] as never[]),
    ]);
    const list = topLevel.map((c) =>
      this.toCommentVo(
        c,
        c.replies.map((r) => this.toCommentVo(r)),
        c._count.replies,
      ),
    );
    // P1-04：第一页将置顶评论合并到顶部（去重）
    const pinnedVos = pinned.map((c) =>
      this.toCommentVo(
        c,
        c.replies.map((r) => this.toCommentVo(r)),
        c._count.replies,
      ),
    );
    const seen = new Set(list.map((c) => c.id));
    const merged = [...pinnedVos.filter((c) => !seen.has(c.id) || true), ...list].filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    // pinned 永远置顶，普通评论保持原序
    merged.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
    return { list: merged, total: total + pinnedVos.filter((c) => !seen.has(c.id)).length, page, pageSize };
  }

  // P1-01 回复分页：顶级评论的完整回复列表（时间升序，page/pageSize）
  async listReplies(
    uid: string,
    postId: string,
    commentId: string,
    page: number,
    pageSize: number,
  ): Promise<PageResult<CommentVo>> {
    const parent = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new BizException(20005, '评论不存在');
    if (parent.parentId !== null) throw new BizException(20005, '只能查看顶级评论的回复');

    const [replies, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId, parentId: commentId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: { select: commentAuthorSelect },
          replyToUser: replyToUserSelect,
          likes: { where: { userId: uid }, select: { id: true }, take: 1 },
        },
      }),
      this.prisma.comment.count({ where: { postId, parentId: commentId } }),
    ]);
    return {
      list: replies.map((r) => this.toCommentVo(r)),
      total,
      page,
      pageSize,
    };
  }

  // P1-01 跳转定位：目标评论（或回复）所属顶级评论 + 其在顶级评论分页（createdAt desc）中的页码
  async locateComment(postId: string, commentId: string, pageSize: number): Promise<LocateResult> {
    const target = await this.prisma.comment.findFirst({
      where: { id: commentId, postId },
      select: { id: true, parentId: true },
    });
    if (!target) throw new BizException(20005, '评论不存在');
    const threadRootId = target.parentId ?? target.id;
    const root = await this.prisma.comment.findUnique({
      where: { id: threadRootId },
      select: { createdAt: true },
    });
    if (!root) throw new BizException(20005, '评论不存在');
    // 顶级评论按 createdAt desc 分页：比 root 新的顶级评论数决定 root 所在页
    const newer = await this.prisma.comment.count({
      where: { postId, parentId: null, createdAt: { gt: root.createdAt } },
    });
    return { threadRootId, page: Math.floor(newer / pageSize) + 1, pageSize };
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
        reporterId: uid,
      },
    });
    return { reported: true };
  }

  private async queryPosts(
    uid: string,
    query: FeedQueryDto,
    circleId: string | undefined,
    communityId?: string,
  ): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const now = new Date();

    // P2-05 feed 主体只查普通帖（pinned=false）；置顶帖仅在首页（无 cursor）额外查合并到头部，翻页不重复。
    // 内容推广：推广中（boostUntil>now）帖子也不进主体查询，首页在 pinned 后合并 boosted，翻页不重复。
    // 内容推广：普通流排除「推广中」（boostUntil>now）。
    // ⚠️ 不能写 boostUntil: { not: { gt: now } }——SQL 三值逻辑下 NOT(NULL > now)=unknown，
    // Prisma 会把 NULL 行一起过滤掉，导致全部未推广帖从 feed 消失；必须显式 OR 空值。
    const boostInactive: Prisma.PostWhereInput = {
      OR: [{ boostUntil: null }, { boostUntil: { lte: now } }],
    };
    const where: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      deletedAt: null,
      visibility: 'PUBLIC',
      pinned: false,
      AND: [boostInactive],
    };
    if (circleId) where.circleId = circleId;
    if (communityId) {
      where.communityId = communityId;
      // 圈子禁用则内容不可见（广场作用域下 admin disable 后 feed 空）
      where.community = { is: { status: CommunityStatus.ACTIVE } };
    }
    if (cursor) {
      // 与游标条件 AND 嵌套（不能扁平化进同一 OR，否则推广中帖会因命中游标漏入）
      where.AND = [
        boostInactive,
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: { equals: cursor.createdAt }, id: { lt: cursor.id } },
          ],
        },
      ];
    }

    const pinnedWhere: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      deletedAt: null,
      visibility: 'PUBLIC',
      pinned: true,
      ...(circleId ? { circleId } : {}),
      ...(communityId ? { communityId, community: { is: { status: CommunityStatus.ACTIVE } } } : {}),
    };

    const boostedWhere: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      deletedAt: null,
      visibility: 'PUBLIC',
      pinned: false,
      boostUntil: { gt: now },
      ...(circleId ? { circleId } : {}),
      ...(communityId ? { communityId, community: { is: { status: CommunityStatus.ACTIVE } } } : {}),
    };

    const [posts, pinnedPosts, boostedPosts] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        include: postInclude(uid),
      }),
      cursor
        ? Promise.resolve([])
        : this.prisma.post.findMany({
            where: pinnedWhere,
            orderBy: [{ createdAt: 'desc' }],
            take: 5,
            include: postInclude(uid),
          }),
      cursor
        ? Promise.resolve([])
        : this.prisma.post.findMany({
            where: boostedWhere,
            orderBy: [{ boostUntil: 'desc' }, { createdAt: 'desc' }],
            take: 20,
            include: postInclude(uid),
          }),
    ]);

    const hasMore = posts.length > limit;
    const slice = hasMore ? posts.slice(0, limit) : posts;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const list = cursor ? slice : [...pinnedPosts, ...boostedPosts, ...slice];
    return { list: list.map((p) => this.toPostVo(p)), nextCursor, hasMore };
  }

  // 热度排序（hot/recommend）：按点赞/评论数排序，首页 take limit，不分页
  private async queryHotPosts(
    uid: string,
    query: FeedQueryDto,
    circleId: string | undefined,
    communityId: string | undefined,
    sort: 'hot' | 'recommend',
  ): Promise<FeedResult> {
    const limit = query.limit ?? 20;
    const now = new Date();
    const base: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      deletedAt: null,
      visibility: 'PUBLIC',
      ...(circleId ? { circleId } : {}),
      ...(communityId ? { communityId, community: { is: { status: CommunityStatus.ACTIVE } } } : {}),
    };
    // 三档合并：置顶 -> 推广中 -> 普通（各档内部按热度排序），再 slice 到 limit
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      sort === 'hot'
        ? [{ likeCount: 'desc' }, { comments: { _count: 'desc' } }, { createdAt: 'desc' }]
        : [{ likeCount: 'desc' }, { createdAt: 'desc' }];
    const [pinned, boosted, normal] = await Promise.all([
      this.prisma.post.findMany({ where: { ...base, pinned: true }, orderBy, take: limit, include: postInclude(uid) }),
      this.prisma.post.findMany({
        where: { ...base, pinned: false, boostUntil: { gt: now } },
        orderBy,
        take: limit,
        include: postInclude(uid),
      }),
      this.prisma.post.findMany({
        where: { ...base, pinned: false, OR: [{ boostUntil: null }, { boostUntil: { lte: now } }] },
        orderBy,
        take: limit,
        include: postInclude(uid),
      }),
    ]);
    const list = [...pinned, ...boosted, ...normal].slice(0, limit);
    return { list: list.map((p) => this.toPostVo(p)), nextCursor: null, hasMore: false };
  }

  // P2-01 置顶最热帖子：全时段最热 top N（首页顶部横向滚动），置顶 -> 推广中 -> 普通 三档
  async listHotTop(uid: string, limit = 10): Promise<{ list: PostVo[] }> {
    const take = Math.min(50, Math.max(1, limit));
    const now = new Date();
    const base: Prisma.PostWhereInput = { status: PostStatus.APPROVED, deletedAt: null, visibility: 'PUBLIC' };
    const orderBy: Prisma.PostOrderByWithRelationInput[] = [{ likeCount: 'desc' }, { comments: { _count: 'desc' } }, { createdAt: 'desc' }];
    const [pinned, boosted, normal] = await Promise.all([
      this.prisma.post.findMany({ where: { ...base, pinned: true }, orderBy, take, include: postInclude(uid) }),
      this.prisma.post.findMany({
        where: { ...base, pinned: false, boostUntil: { gt: now } },
        orderBy,
        take,
        include: postInclude(uid),
      }),
      this.prisma.post.findMany({
        where: { ...base, pinned: false, OR: [{ boostUntil: null }, { boostUntil: { lte: now } }] },
        orderBy,
        take,
        include: postInclude(uid),
      }),
    ]);
    return { list: [...pinned, ...boosted, ...normal].slice(0, take).map((p) => this.toPostVo(p)) };
  }

  // P2-02 今日上头：近 24h 最热，page 分页（滚动加载），置顶 -> 推广中 -> 普通；推广仅首页前置
  async listTodayHit(uid: string, page = 1, pageSize = 20): Promise<PageResult<PostVo>> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();
    const baseWhere: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      deletedAt: null,
      visibility: 'PUBLIC',
      createdAt: { gte: since },
    };
    const orderBy: Prisma.PostOrderByWithRelationInput[] = [{ likeCount: 'desc' }, { comments: { _count: 'desc' } }, { createdAt: 'desc' }];
    // 首页前置 pinned + boosted。⚠️ 前置会挤掉普通帖主体切片尾部，翻页 skip 必须减去
    // prepended 条位移，否则恰好有 1+ 条普通帖首页/次页都查不到（分页丢帖）。pinned 同样触发。
    const [pinned, boosted] = await Promise.all([
      this.prisma.post.findMany({ where: { ...baseWhere, pinned: true }, orderBy, take: pageSize, include: postInclude(uid) }),
      this.prisma.post.findMany({
        where: { ...baseWhere, pinned: false, boostUntil: { gt: now } },
        orderBy: [{ boostUntil: 'desc' }, ...orderBy],
        take: pageSize,
        include: postInclude(uid),
      }),
    ]);
    const prepended = Math.min(pageSize, pinned.length + boosted.length);
    const skip = Math.max(0, (page - 1) * pageSize - prepended);
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { ...baseWhere, pinned: false, OR: [{ boostUntil: null }, { boostUntil: { lte: now } }] },
        orderBy,
        skip,
        take: pageSize,
        include: postInclude(uid),
      }),
      this.prisma.post.count({ where: baseWhere }),
    ]);
    // 首页：前置 + 普通帖主体（多余的普通帖被 slice 裁掉）；翻页：仅普通帖，不重复前置
    const list = page > 1 ? posts : [...pinned, ...boosted, ...posts].slice(0, pageSize);
    return { list: list.map((p) => this.toPostVo(p)), total, page, pageSize };
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
      where: { status: PostStatus.APPROVED, deletedAt: null, visibility: 'PUBLIC', authorId: { in: followeeIds } },
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
      authorId: isAnonymous ? '' : post.authorId,
      authorNickname: isAnonymous ? (post.anonName ?? '匿名用户') : post.author.nickname,
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
      visibility: post.visibility,
      pinned: post.pinned, // P2-05
      featured: post.featured, // P2-05
      boosted: post.boostUntil ? post.boostUntil.getTime() > Date.now() : false, // 内容推广
      boostUntil: post.boostUntil ? post.boostUntil.toISOString() : null,
      publishAt: post.publishAt ? post.publishAt.toISOString() : null, // P2-06
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
    };
  }

  private toCommentVo(
    comment: {
      id: string;
      postId: string;
      authorId: string;
      content: string;
      parentId: string | null;
      likeCount: number;
      pinned: boolean;
      createdAt: Date;
      author: { nickname: string; avatarUrl: string | null };
      replyToUser: { nickname: string } | null;
      likes?: { id: string }[];
    },
    replies: CommentVo[] = [],
    replyCount = 0,
  ): CommentVo {
    return {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      authorNickname: comment.author.nickname,
      authorAvatarUrl: comment.author.avatarUrl,
      content: comment.content,
      parentId: comment.parentId,
      replyToNickname: comment.replyToUser?.nickname ?? null,
      replies,
      replyCount,
      likeCount: comment.likeCount,
      liked: !!comment.likes && comment.likes.length > 0,
      pinned: comment.pinned,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  // P1-02 评论点赞 toggle（commentId 不存在抛 20005；并发 P2002/P2025 兜底）
  async toggleCommentLike(uid: string, commentId: string): Promise<{ liked: boolean; likeCount: number }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, postId: true },
    });
    if (!comment) throw new BizException(20005, '评论不存在');

    const existing = await this.prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: uid } },
    });
    if (existing) {
      try {
        await this.prisma.$transaction([
          this.prisma.commentLike.delete({ where: { id: existing.id } }),
          this.prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } }),
        ]);
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) throw e;
      }
    } else {
      try {
        await this.prisma.$transaction([
          this.prisma.commentLike.create({ data: { commentId, userId: uid } }),
          this.prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }),
        ]);
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
      // P1-02 评论点赞通知（不通知自己）
      if (comment.authorId !== uid) {
        void this.notification
          .createFromActor({
            actorUid: uid,
            targetUid: comment.authorId,
            type: NotificationType.COMMENT_LIKE,
            title: '表白墙 · 评论点赞',
            content: (a) => `${a} 赞了你的评论`,
            targetType: 'post',
            targetId: comment.postId,
            extraId: commentId,
          })
          .catch((e: unknown) =>
            this.logger.warn(`notify comment like failed: ${e instanceof Error ? e.message : String(e)}`),
          );
      }
    }
    const after = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { likeCount: true } });
    const stillLiked = await this.prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId: uid } },
      select: { id: true },
    });
    invalidateFeedCache();
    return { liked: !!stillLiked, likeCount: Math.max(0, after?.likeCount ?? 0) };
  }

  // P1-04 热评置顶：定时（每小时）勾子，每帖取热度 top 2 标 pinned=true，余回 false
  async refreshHotPins() {
    // 各帖先清后置（事务内逐帖更新，简单起见单事务批量）
    const groups = await this.prisma.comment.groupBy({
      by: ['postId'],
      where: { parentId: null },
      _count: true,
    });
    for (const g of groups) {
      const top = await this.prisma.comment.findMany({
        where: { postId: g.postId, parentId: null },
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 2,
        select: { id: true },
      });
      const ids = top.map((c) => c.id);
      await this.prisma.$transaction([
        this.prisma.comment.updateMany({
          where: { postId: g.postId, parentId: null },
          data: { pinned: false },
        }),
        this.prisma.comment.updateMany({
          where: { id: { in: ids } },
          data: { pinned: true },
        }),
      ]);
    }
  }

  // P2-06 定时发布：扫 DRAFT + publishAt<=now 的帖，逐条走内容安全审核 -> 通过转 PUBLIC，失败保持 DRAFT + 通知作者
  async publishScheduledPosts() {
    const due = await this.prisma.post.findMany({
      where: { visibility: 'DRAFT', publishAt: { not: null, lte: new Date() }, deletedAt: null },
      take: 50,
    });
    if (due.length === 0) return { published: 0, failed: 0 };
    let published = 0;
    let failed = 0;
    for (const post of due) {
      try {
        await this.moderation.checkText(post.content);
        for (const url of post.images) {
          await this.moderation.checkImage(url);
        }
        if (post.videoCover) await this.moderation.checkImage(post.videoCover);
        // 审核通过：转 PUBLIC + 清 publishAt（避免重复触发）
        await this.prisma.post.update({
          where: { id: post.id },
          data: { visibility: 'PUBLIC', publishAt: null },
        });
        published += 1;
      } catch (e) {
        // 审核失败（90002 等）：保持 DRAFT，清 publishAt 终止重试，通知作者
        failed += 1;
        await this.prisma.post.update({
          where: { id: post.id },
          data: { publishAt: null },
        }).catch(() => undefined);
        void this.notification
          .create({
            userId: post.authorId,
            type: NotificationType.POST_TAKEDOWN,
            title: '表白墙 · 定时发布失败',
            content: `你的定时帖因内容审核未通过未能发布，请编辑后重发：${post.content.slice(0, 30)}`,
            targetType: 'post',
            targetId: post.id,
          })
          .catch((err: unknown) =>
            this.logger.warn(`notify scheduled publish failed: ${err instanceof Error ? err.message : String(err)}`),
          );
        this.logger.warn(`scheduled publish ${post.id} moderation failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (published > 0) invalidateFeedCache();
    return { published, failed };
  }

  // P1-05 搜索帖子内容（大小写不敏感包含）
  async searchPosts(uid: string, q: string, limit: number) {
    const kw = q.trim();
    if (!kw) return { list: [] as PostVo[] };
    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.APPROVED,
        deletedAt: null,
        visibility: 'PUBLIC',
        content: { contains: kw, mode: 'insensitive' },
      },
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: postInclude(uid),
    });
    void this.recordSearch(uid, kw).catch(() => {});
    return { list: posts.map((p) => this.toPostVo(p)) };
  }

  // P1-06 搜索用户昵称
  async searchUsers(uid: string, q: string, limit: number) {
    const kw = q.trim();
    if (!kw) return { list: [] as { id: string; nickname: string; avatarUrl: string | null }[] };
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        nickname: { contains: kw, mode: 'insensitive' },
      },
      orderBy: [{ id: 'desc' }],
      take: limit,
      select: { id: true, nickname: true, avatarUrl: true },
    });
    void this.recordSearch(uid, kw).catch(() => {});
    return { list: users };
  }

  // P1-07 搜索话题/标签（对 posts.tags 数组做包含）
  async searchTags(uid: string, q: string, limit: number) {
    const kw = q.trim();
    if (!kw) return { list: [] as { tag: string; postCount: number }[] };
    // tags 是 String[]；PG hasArrayContain? 用 contains
    const matched = await this.prisma.post.findMany({
      where: {
        status: PostStatus.APPROVED,
        deletedAt: null,
        visibility: 'PUBLIC',
        tags: { has: kw },
      },
      orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
      take: limit * 4,
      select: { tags: true },
    });
    const counter = new Map<string, number>();
    for (const p of matched) {
      for (const t of p.tags) {
        if (t.toLowerCase().includes(kw.toLowerCase())) {
          counter.set(t, (counter.get(t) ?? 0) + 1);
        }
      }
    }
    const list = [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, postCount]) => ({ tag, postCount }));
    void this.recordSearch(uid, kw).catch(() => {});
    return { list };
  }

  // P1-07 热搜词：取计数前 10
  async hotKeywords() {
    const rows = await this.prisma.hotSearch.findMany({
      orderBy: [{ count: 'desc' }],
      take: 10,
      select: { keyword: true, count: true },
    });
    return { list: rows.map((r) => ({ keyword: r.keyword, count: r.count })) };
  }

  // P1-07 搜索记录 + 热度统计
  private async recordSearch(uid: string, keyword: string) {
    if (!uid) return;
    // 单用户最近 10 条：先插再裁剪
    await this.prisma.searchHistory.create({ data: { userId: uid, keyword } });
    const old = await this.prisma.searchHistory.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      select: { id: true },
    });
    if (old.length > 0) {
      await this.prisma.searchHistory.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
    // 热度统计：upsert + count++（无锁，并发可略超）
    await this.prisma.hotSearch.upsert({
      where: { keyword },
      create: { keyword, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  // ===== P2-03 活动专题（前台浏览）=====

  async listActivityTopics(): Promise<ActivityTopicVo[]> {
    const topics = await this.prisma.activityTopic.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return topics.map((t) => ({
      id: t.id,
      title: t.title,
      coverUrl: t.coverUrl,
      description: t.description,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  // 活动专题详情 + 关联帖子（按 sortOrder -> createdAt）
  async getActivityTopic(uid: string, id: string): Promise<{ topic: ActivityTopicVo; posts: PostVo[] }> {
    const topic = await this.prisma.activityTopic.findFirst({
      where: { id, status: 'PUBLISHED' },
    });
    if (!topic) throw new BizException(20001, '活动专题不存在', HttpStatus.NOT_FOUND);
    const links = await this.prisma.activityTopicPost.findMany({
      where: { topicId: id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { post: { include: postInclude(uid) } },
      take: 50,
    });
    const posts = links
      .filter((l) => l.post && l.post.status === PostStatus.APPROVED && !l.post.deletedAt && l.post.visibility === 'PUBLIC')
      .map((l) => this.toPostVo(l.post));
    return {
      topic: {
        id: topic.id,
        title: topic.title,
        coverUrl: topic.coverUrl,
        description: topic.description,
        sortOrder: topic.sortOrder,
        createdAt: topic.createdAt.toISOString(),
      },
      posts,
    };
  }

  // ===== P2-04 校园话题（前台浏览）=====

  async listTopics(): Promise<TopicVo[]> {
    const topics = await this.prisma.topic.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { posts: true } } },
    });
    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      coverUrl: t.coverUrl,
      postCount: t._count.posts,
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  // 话题详情 + 该话题帖子（分页）
  async getTopic(uid: string, id: string, page = 1, pageSize = 20): Promise<{ topic: TopicVo; posts: PageResult<PostVo> }> {
    const topic = await this.prisma.topic.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: { _count: { select: { posts: true } } },
    });
    if (!topic) throw new BizException(20001, '话题不存在', HttpStatus.NOT_FOUND);
    const where: Prisma.PostWhereInput = {
      topicId: id,
      status: PostStatus.APPROVED,
      deletedAt: null,
      visibility: 'PUBLIC',
    };
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: postInclude(uid),
      }),
      this.prisma.post.count({ where }),
    ]);
    return {
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        coverUrl: topic.coverUrl,
        postCount: topic._count.posts,
        sortOrder: topic.sortOrder,
        createdAt: topic.createdAt.toISOString(),
      },
      posts: { list: posts.map((p) => this.toPostVo(p)), total, page, pageSize },
    };
  }
}
