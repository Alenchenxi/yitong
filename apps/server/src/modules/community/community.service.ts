import { HttpStatus, Injectable } from '@nestjs/common';
import { Community, CommunityMemberRole, CommunityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { BizException } from '../../common/exceptions/biz.exception';
import type { BannerVo, CommunityMineResult, CommunityVo, TodayHotItem } from './community.types';
import type { CreateCommunityDto } from './dto/community.dto';

// 默认圈子（迁移 seed 固定 id cm_default；存量内容 + 新用户惰性加入都落到它）
export const DEFAULT_COMMUNITY_ID = 'cm_default';

// 错误码 8xxxx 圈子段（80010+；80001-80003 为拉新段保留）
const ERR_COMMUNITY_NOT_FOUND = 80010;
const ERR_COMMUNITY_DISABLED = 80011;
const ERR_ALREADY_MEMBER = 80012;
const ERR_NOT_MEMBER = 80013;
const ERR_NOT_JOINED = 80014; // 未加入任何圈子（写路径引导加入）
const ERR_COMMUNITY_FORBIDDEN = 80015;

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  /**
   * 用户当前圈子 id（写路径单真相源）：
   * - 已有 activeCommunityId 且圈子 ACTIVE → 返回
   * - 否则抛 80014「请先加入圈子」（不再惰性自动加入 cm_default，否则加入页永不出现）
   * 发帖/发岗等写入口调用；读路径（feed/banners）用 resolveFeedCommunityId 兜底默认圈。
   */
  async getActiveCommunityId(uid: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { activeCommunityId: true },
    });
    const activeId = user?.activeCommunityId;
    if (activeId) {
      const active = await this.prisma.community.findUnique({
        where: { id: activeId },
        select: { status: true },
      });
      if (active && active.status === CommunityStatus.ACTIVE) return activeId;
    }
    throw new BizException(ERR_NOT_JOINED, '请先加入圈子', HttpStatus.FORBIDDEN);
  }

  /**
   * 读路径圈子兜底（feed/banners/今日上头等）：
   * - 显式传入 communityId → 直接用
   * - 否则取用户当前圈子，ACTIVE 才用；未加入/失效 → 兜底默认圈子 cm_default（不抛错）
   * 写路径（发帖/发岗）仍走 getActiveCommunityId 严格抛 80014。
   */
  async resolveFeedCommunityId(uid: string, requested?: string | null): Promise<string> {
    if (requested) return requested;
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { activeCommunityId: true },
    });
    const activeId = user?.activeCommunityId;
    if (activeId) {
      const active = await this.prisma.community.findUnique({
        where: { id: activeId },
        select: { status: true },
      });
      if (active && active.status === CommunityStatus.ACTIVE) return activeId;
    }
    return DEFAULT_COMMUNITY_ID;
  }

  /**
   * 记录浏览量：ContentView 去重（同 target+viewer+hourBucket 只记 1 次）。
   * fire-and-forget 调用（如 GET 详情埋点），失败静默（.catch 在上层）。
   * 红线：anon_post 的 viewerKey 必须传 anonId，绝不传真实 uid。
   */
  async recordContentView(targetType: 'post' | 'anon_post', targetId: string, viewerKey: string): Promise<void> {
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    try {
      await this.prisma.contentView.create({
        data: { targetType, targetId, viewerKey, hourBucket },
        select: { id: true },
      });
    } catch {
      // P2002 去重：同 (target, viewer, hourBucket) 已存在则忽略
    }
  }

  /** 全部 ACTIVE 圈子 + 当前用户 isMember/myRole；可选按 category 过滤（广场左侧分类） */
  async listPublic(uid: string, category?: string): Promise<CommunityVo[]> {
    const [communities, memberships] = await Promise.all([
      this.prisma.community.findMany({
        where: {
          status: CommunityStatus.ACTIVE,
          ...(category ? { category } : {}),
        },
        orderBy: [{ memberCount: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.communityMember.findMany({
        where: { userId: uid },
        select: { communityId: true, role: true },
      }),
    ]);
    const memberMap = new Map(memberships.map((m) => [m.communityId, m.role]));
    return communities.map((c) => this.toVo(c, memberMap.get(c.id) ?? null));
  }

  /** 圈子搜索：name 模糊匹配（ACTIVE，最多 20 条） */
  async search(uid: string, keyword: string): Promise<CommunityVo[]> {
    const kw = keyword.trim();
    if (!kw) return [];
    const [communities, memberships] = await Promise.all([
      this.prisma.community.findMany({
        where: {
          status: CommunityStatus.ACTIVE,
          name: { contains: kw, mode: 'insensitive' },
        },
        orderBy: [{ memberCount: 'desc' }, { createdAt: 'asc' }],
        take: 20,
      }),
      this.prisma.communityMember.findMany({
        where: { userId: uid },
        select: { communityId: true, role: true },
      }),
    ]);
    const memberMap = new Map(memberships.map((m) => [m.communityId, m.role]));
    return communities.map((c) => this.toVo(c, memberMap.get(c.id) ?? null));
  }

  /** 我加入的圈子 + 当前 activeId */
  async listMine(uid: string): Promise<CommunityMineResult> {
    const [user, memberships] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: uid }, select: { activeCommunityId: true } }),
      this.prisma.communityMember.findMany({
        where: { userId: uid },
        include: { community: true },
        orderBy: { joinedAt: 'desc' },
      }),
    ]);
    return {
      activeId: user?.activeCommunityId ?? null,
      list: memberships.map((m) => this.toVo(m.community, m.role)),
    };
  }

  /** 当前圈子（未加入 / active 失效 → null，由广场引导到加入页） */
  async getActive(uid: string): Promise<CommunityVo | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      select: { activeCommunityId: true },
    });
    const activeId = user?.activeCommunityId;
    if (!activeId) return null;
    const community = await this.prisma.community.findUnique({ where: { id: activeId } });
    if (!community || community.status !== CommunityStatus.ACTIVE) return null;
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: activeId, userId: uid } },
      select: { role: true },
    });
    return this.toVo(community, member?.role ?? null);
  }

  /** 圈子详情（DISABLED 视为不存在） */
  async detail(uid: string, id: string): Promise<CommunityVo> {
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community || community.status !== CommunityStatus.ACTIVE) {
      throw new BizException(ERR_COMMUNITY_NOT_FOUND, '圈子不存在', HttpStatus.NOT_FOUND);
    }
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: uid } },
      select: { role: true },
    });
    return this.toVo(community, member?.role ?? null);
  }

  /** 创建圈子：creator → OWNER + 成员 + 置 active */
  async create(uid: string, dto: CreateCommunityDto, openid?: string): Promise<CommunityVo> {
    const name = dto.name.trim();
    await this.moderation.checkText(name, openid);
    if (dto.description) await this.moderation.checkText(dto.description, openid);
    return this.prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name,
          logo: dto.logo ?? null,
          description: dto.description?.trim() || null,
          category: dto.category,
          region: dto.region.trim(),
          location: dto.location.trim(),
          ownerId: uid,
          memberCount: 1,
        },
      });
      await tx.communityMember.create({
        data: { communityId: community.id, userId: uid, role: CommunityMemberRole.OWNER },
      });
      await tx.user.update({ where: { id: uid }, data: { activeCommunityId: community.id } });
      return this.toVo(community, CommunityMemberRole.OWNER);
    });
  }

  /** 加入圈子（同时置为当前圈子） */
  async join(uid: string, id: string): Promise<{ id: string }> {
    const community = await this.prisma.community.findUnique({ where: { id } });
    if (!community || community.status !== CommunityStatus.ACTIVE) {
      throw new BizException(ERR_COMMUNITY_DISABLED, '圈子不可加入', HttpStatus.BAD_REQUEST);
    }
    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: uid } },
      select: { id: true },
    });
    if (existing) throw new BizException(ERR_ALREADY_MEMBER, '已加入该圈子', HttpStatus.BAD_REQUEST);
    await this.prisma.communityMember.create({
      data: { communityId: id, userId: uid, role: CommunityMemberRole.MEMBER },
    });
    await this.prisma.community.update({ where: { id }, data: { memberCount: { increment: 1 } } });
    await this.prisma.user.update({ where: { id: uid }, data: { activeCommunityId: id } });
    return { id };
  }

  /** 退出圈子（圈主不可退；若退出的是当前圈子则清空 active，下次惰性兜底默认） */
  async leave(uid: string, id: string): Promise<{ id: string }> {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: uid } },
    });
    if (!member) throw new BizException(ERR_NOT_MEMBER, '未加入该圈子', HttpStatus.BAD_REQUEST);
    if (member.role === CommunityMemberRole.OWNER) {
      throw new BizException(10003, '圈主不能退出圈子', HttpStatus.FORBIDDEN);
    }
    await this.prisma.communityMember.delete({ where: { id: member.id } });
    await this.prisma.community.update({ where: { id }, data: { memberCount: { decrement: 1 } } });
    await this.prisma.user.updateMany({
      where: { id: uid, activeCommunityId: id },
      data: { activeCommunityId: null },
    });
    return { id };
  }

  /** 切换当前圈子（须已是成员 + ACTIVE） */
  async switchActive(uid: string, communityId: string): Promise<{ id: string }> {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community || community.status !== CommunityStatus.ACTIVE) {
      throw new BizException(ERR_COMMUNITY_NOT_FOUND, '圈子不存在', HttpStatus.NOT_FOUND);
    }
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: uid } },
      select: { id: true },
    });
    if (!member) throw new BizException(ERR_NOT_MEMBER, '未加入该圈子，无法切换', HttpStatus.BAD_REQUEST);
    await this.prisma.user.update({ where: { id: uid }, data: { activeCommunityId: communityId } });
    return { id: communityId };
  }

  /** 今日上头：近24h 浏览量 TopN（跨 表白墙帖 + 树洞帖，按圈子过滤 + 状态过滤） */
  async getTodayHot(communityId: string, limit: number): Promise<TodayHotItem[]> {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const rows = await this.prisma.$queryRaw<{ target_type: string; target_id: string; cnt: number }[]>`
      SELECT cv.target_type, cv.target_id, COUNT(*)::integer AS cnt
      FROM content_views cv
      WHERE cv.created_at >= ${since}
        AND cv.target_type IN ('post', 'anon_post')
        AND (
          (cv.target_type = 'post' AND EXISTS (
            SELECT 1 FROM posts p JOIN communities c ON c.id = p.community_id
            WHERE p.id = cv.target_id AND p.community_id = ${communityId}
              AND p.status = 'APPROVED' AND p.visibility = 'PUBLIC' AND p.deleted_at IS NULL
              AND c.status = 'ACTIVE'
          ))
          OR
          (cv.target_type = 'anon_post' AND EXISTS (
            SELECT 1 FROM anonymous_posts a JOIN communities c ON c.id = a.community_id
            WHERE a.id = cv.target_id AND a.community_id = ${communityId} AND a.status = 'APPROVED'
              AND c.status = 'ACTIVE'
          ))
        )
      GROUP BY cv.target_type, cv.target_id
      ORDER BY cnt DESC, cv.target_id ASC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      targetType: r.target_type as 'post' | 'anon_post',
      targetId: r.target_id,
      viewCount: r.cnt,
    }));
  }

  /** 广告位：圈子 + 全局 Banner（ENABLED，sortOrder asc） */
  async listBanners(communityId: string): Promise<BannerVo[]> {
    const rows = await this.prisma.banner.findMany({
      where: { status: 'ENABLED', OR: [{ communityId }, { communityId: null }] },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((b) => ({ id: b.id, title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl }));
  }

  private toVo(c: Community, role: CommunityMemberRole | null): CommunityVo {
    return {
      id: c.id,
      name: c.name,
      logo: c.logo,
      description: c.description,
      category: c.category,
      region: c.region,
      location: c.location,
      memberCount: c.memberCount,
      postCount: c.postCount,
      status: c.status,
      isMember: role !== null,
      myRole: role,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
