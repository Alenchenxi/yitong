import { Injectable } from '@nestjs/common';
import { JobPostStatus, PostStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// 数据看板：统计发帖量/兼职成交/用户/商家等关键指标 + 近 7 天趋势
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [
      totalUsers,
      totalMerchants,
      totalPosts,
      totalAnonPosts,
      totalJobPosts,
      publishedJobPosts,
      totalApplications,
      totalReviews,
      todayPosts,
      todayAnonPosts,
      todayApplications,
      todayNewUsers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.merchant.count(),
      this.prisma.post.count({ where: { status: PostStatus.APPROVED } }),
      this.prisma.anonymousPost.count({ where: { status: PostStatus.APPROVED } }),
      this.prisma.jobPost.count(),
      this.prisma.jobPost.count({ where: { status: JobPostStatus.PUBLISHED } }),
      this.prisma.jobApplication.count(),
      this.prisma.jobReview.count(),
      this.prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.anonymousPost.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.jobApplication.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
    ]);

    // 近 7 天趋势：每天的发帖量 + 报名量 + 新用户
    const trend = await this.getTrend(sevenDaysAgo);

    return {
      overview: {
        totalUsers,
        totalMerchants,
        totalPosts,
        totalAnonPosts,
        totalJobPosts,
        publishedJobPosts,
        totalApplications,
        totalReviews,
      },
      today: {
        newPosts: todayPosts,
        newAnonPosts: todayAnonPosts,
        newApplications: todayApplications,
        newUsers: todayNewUsers,
      },
      trend, // [{ date, posts, applications, newUsers }]
    };
  }

  private async getTrend(since: Date) {
    // Prisma 不原生支持按日期分组，用 raw SQL
    const rows = await this.prisma.$queryRaw<
      Array<{ date: string; posts: bigint; applications: bigint; new_users: bigint }>
    >`
      SELECT
        d::text AS date,
        COALESCE((
          SELECT COUNT(*) FROM posts WHERE created_at >= d AND created_at < d + INTERVAL '1 day' AND status = 'APPROVED'
        ) + (
          SELECT COUNT(*) FROM anonymous_posts WHERE created_at >= d AND created_at < d + INTERVAL '1 day' AND status = 'APPROVED'
        ), 0) AS posts,
        COALESCE((
          SELECT COUNT(*) FROM job_applications WHERE created_at >= d AND created_at < d + INTERVAL '1 day'
        ), 0) AS applications,
        COALESCE((
          SELECT COUNT(*) FROM users WHERE created_at >= d AND created_at < d + INTERVAL '1 day' AND deleted_at IS NULL
        ), 0) AS new_users
      FROM generate_series(${since}::date, CURRENT_DATE, '1 day') AS d
      ORDER BY d
    `;
    return rows.map((r) => ({
      date: r.date,
      posts: Number(r.posts),
      applications: Number(r.applications),
      newUsers: Number(r.new_users),
    }));
  }
}
