import { Injectable } from '@nestjs/common';
import { Prisma, PostStatus, PostVisibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeholeService } from '../treehole/treehole.service';
import type { PostVo } from '../confession/types';
import type { AnonPostVo } from '../treehole/types';
import type { FeedItemVo, SquareFeedResult } from './types';
import type { SquareFeedQueryDto, SquareFeedSort } from './dto';

// CR-001 广场 union feed：合并表白墙公开帖 + 树洞个人匿名动态
// 红线：anon_post kind 的 data 严禁回填 authorId/authorNickname/authorAvatarUrl 等真实身份字段
@Injectable()
export class SquareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly treehole: TreeholeService,
  ) {}

  /**
   * 广场混合流 union feed
   *
   * 合并表白墙公开帖（PostVo）与树洞个人匿名动态（AnonPostVo），
   * 按 createdAt desc 穿插排序。fetchSize = limit * 2 覆盖双源
   * 排序后的真实 limit。支持 base64url JSON cursor 分页。
   *
   * @param uid   用户真实 uid（access token 已鉴权，用于 Post 部分 liked 查询）
   * @param anonId 树洞匿名 id（x-anon-token 解析；缺失时匿名帖 liked 恒 false）
   * @param q     sort=recommend|latest, cursor, limit
   * @returns     FeedItemVo 混合列表 + cursor 分页信息
   *
   * 红线：anon_post kind 的 AnonPostVo 严禁回填真实身份字段
   */
  async feed(uid: string, anonId: string | null, q: SquareFeedQueryDto): Promise<SquareFeedResult> {
    const limit = q.limit ?? 20;
    const sort: SquareFeedSort = q.sort ?? 'recommend';
    const fetchSize = limit * 2;

    // 并行拉取双源（不串行，提性能）
    const [posts, anonPosts] = await Promise.all([
      this.fetchApprovedPosts(uid, sort, fetchSize, q.cursor),
      this.fetchApprovedAnonPosts(anonId, sort, fetchSize, q.cursor),
    ]);

    // VO 映射 + 合并排序 + 分页切片
    return this.mergeAndPaginate(
      posts.map((p) => ({ kind: 'post' as const, data: this.toPostVo(p) })),
      anonPosts.map((p) => ({ kind: 'anon_post' as const, data: this.toAnonPostVo(p, anonId) })),
      limit,
    );
  }

  /**
   * 合并两个 FeedItemVo 列表，按 createdAt desc（id 兜底避同时间戳错位），
   * 切片取前 limit 条并计算 nextCursor（base64url JSON 编码的 {t, id}）。
   */
  private mergeAndPaginate(
    postItems: FeedItemVo[],
    anonItems: FeedItemVo[],
    limit: number,
  ): SquareFeedResult {
    const merged: FeedItemVo[] = [...postItems, ...anonItems];
    merged.sort((a, b) => {
      const cmp = b.data.createdAt.localeCompare(a.data.createdAt);
      return cmp !== 0 ? cmp : b.data.id.localeCompare(a.data.id);
    });
    const slice = merged.slice(0, limit);
    const hasMore = merged.length > limit;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last ? this.encodeCursor(last.data.createdAt, last.data.id) : null;
    return { list: slice, nextCursor, hasMore };
  }

  // ===== Post 部分查询（复用 confession.service 的查询模式）=====
  private async fetchApprovedPosts(
    uid: string,
    sort: SquareFeedSort,
    fetchSize: number,
    cursor?: string,
  ) {
    const cur = cursor ? this.decodeCursor(cursor) : null;
    const where: Prisma.PostWhereInput = {
      status: PostStatus.APPROVED,
      visibility: PostVisibility.PUBLIC,
      deletedAt: null,
    };
    if (cur) {
      where.OR = [
        { createdAt: { lt: cur.createdAt } },
        { createdAt: { equals: cur.createdAt }, id: { lt: cur.id } },
      ];
    }
    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      sort === 'recommend'
        ? [{ featured: 'desc' }, { pinned: 'desc' }, { likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];
    return this.prisma.post.findMany({
      where,
      orderBy,
      take: fetchSize,
      include: {
        author: { select: { id: true, nickname: true, avatarUrl: true } },
        _count: { select: { comments: true } },
        postLikes: { where: { userId: uid }, select: { id: true }, take: 1 },
      },
    });
  }

  // ===== AnonymousPost 部分查询（复用 treehole.service.getBlockedPeerSet 屏蔽隔离）=====
  private async fetchApprovedAnonPosts(
    anonId: string | null,
    sort: SquareFeedSort,
    fetchSize: number,
    cursor?: string,
  ) {
    const cur = cursor ? this.decodeCursor(cursor) : null;
    const baseWhere: Prisma.AnonymousPostWhereInput = { status: PostStatus.APPROVED };
    // P0-16 屏蔽隔离延续到广场 union 列表（仅当有 anonId 时计算）
    if (anonId) {
      const blockedPeers = await this.treehole.getBlockedPeerSet(anonId);
      if (blockedPeers.size > 0) baseWhere.anonId = { notIn: [...blockedPeers] };
    }
    if (cur) {
      baseWhere.OR = [
        { createdAt: { lt: cur.createdAt } },
        { createdAt: { equals: cur.createdAt }, id: { lt: cur.id } },
      ];
    }
    const orderBy: Prisma.AnonymousPostOrderByWithRelationInput[] =
      sort === 'recommend'
        ? [{ likeCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];
    return this.prisma.anonymousPost.findMany({
      where: baseWhere,
      orderBy,
      take: fetchSize,
      include: anonId
        ? { likes: { where: { anonId }, select: { id: true }, take: 1 } }
        : undefined,
    });
  }

  // ===== VO 映射 =====
  // 复用 confession.service.toPostVo 逻辑（避免改 confession 模块，回归风险）
  private toPostVo(post: {
    id: string;
    circleId: string;
    authorId: string;
    content: string;
    images: string[];
    tags: string[];
    isAnonymous: boolean;
    anonName: string | null;
    videoUrl: string | null;
    videoCover: string | null;
    likeCount: number;
    visibility: PostVisibility;
    pinned: boolean;
    featured: boolean;
    publishAt: Date | null;
    createdAt: Date;
    editedAt: Date | null;
    author: { nickname: string; avatarUrl: string | null };
    _count: { comments: number };
    postLikes: { id: string }[];
  }): PostVo {
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
      pinned: post.pinned,
      featured: post.featured,
      publishAt: post.publishAt ? post.publishAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      editedAt: post.editedAt ? post.editedAt.toISOString() : null,
    };
  }

  // 复用 treehole.service.toVo 逻辑（匿名帖，严禁真实身份字段）
  private toAnonPostVo(
    p: {
      id: string;
      anonId: string;
      content: string;
      images: string[];
      mood: string | null;
      likeCount: number;
      createdAt: Date;
      likes?: { id: string }[];
    },
    anonId: string | null,
  ): AnonPostVo {
    return {
      id: p.id,
      anonId: p.anonId,
      content: p.content,
      images: p.images,
      mood: p.mood,
      likeCount: p.likeCount,
      // anonId 缺失时 liked 恒 false；有 anonId 时按 likes 关联判断
      liked: anonId ? (p.likes?.length ?? 0) > 0 : false,
      createdAt: p.createdAt.toISOString(),
    };
  }

  // ===== cursor 编解码（base64url JSON，与 confession 模式一致但独立实现）=====
  private encodeCursor(createdAt: string, id: string): string {
    const payload = JSON.stringify({ t: createdAt, id });
    return Buffer.from(payload, 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(raw) as { t?: string; id?: string };
      if (!parsed.t || !parsed.id) return null;
      const createdAt = new Date(parsed.t);
      if (Number.isNaN(createdAt.getTime())) return null;
      return { createdAt, id: parsed.id };
    } catch {
      return null;
    }
  }
}
