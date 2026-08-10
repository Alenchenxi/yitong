// 智能生成流程(2026-08-10):模板引擎 + DB 统计 + 包装返回。
// 评分/median 全在请求时实时算,落库字段不动(评分不写 DB)。

import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BizException } from '../../common/exceptions/biz.exception';
import {
  JOB_CATEGORY_GRID,
  CategoryKey,
  mapKeyToCategories,
  isValidCategoryKey,
} from './job.template.data';
import { generateDraft } from './job.template';
import type { JobTemplateQueryDto } from './dto/job-template.dto';

@Injectable()
export class JobTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  // 类别网格(无需登录鉴权,直接返回)
  listCategories() {
    return {
      items: JOB_CATEGORY_GRID.map((c) => ({
        key: c.key,
        label: c.label,
        icon: c.icon,
        mapTo: c.mapTo,
      })),
    };
  }

  // 智能生成:商家 APPROVED 才允许
  async generate(merchantUid: string, q: JobTemplateQueryDto) {
    if (!isValidCategoryKey(q.key)) {
      throw new BizException(40001, `类别 key 不在白名单:${q.key}`, HttpStatus.BAD_REQUEST);
    }
    const merchant = await this.prisma.merchant.findUnique({ where: { userId: merchantUid } });
    if (!merchant || merchant.status !== 'APPROVED') {
      throw new BizException(60003, '商家资质未审核通过', HttpStatus.FORBIDDEN);
    }
    if (q.salaryType === 'range' && (q.salaryAmount === undefined || q.salaryAmount <= 0)) {
      throw new BizException(40002, '范围薪资必须传 salaryAmount', HttpStatus.BAD_REQUEST);
    }

    // 取最近 30 天同 mapTo 类目 PUBLISHED+未过期 salaryAmount 中位数
    const cat = q.key as CategoryKey;
    const mapped = mapKeyToCategories(cat);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const whereForMedian = {
      status: 'PUBLISHED' as const,
      expireAt: { gt: new Date() },
      createdAt: { gt: since },
      ...(mapped.length > 0 ? { category: { in: mapped as ('CATERING' | 'RETAIL' | 'PROMOTION' | 'EXHIBITION' | 'TUTORING' | 'CAMPUS_AGENT' | 'ONLINE' | 'SURVEY' | 'INTERNSHIP' | 'LONG_TERM')[] } } : {}),
    };
    let categoryMedian: number | null = null;
    let sampleSize = 0;
    try {
      const agg = await this.prisma.jobPost.aggregate({
        where: whereForMedian,
        _avg: { salaryAmount: true },
        _count: { _all: true },
      });
      sampleSize = agg._count._all;
      if (agg._avg.salaryAmount != null) {
        categoryMedian = Math.round(agg._avg.salaryAmount);
      }
    } catch {
      // 已知限制:aggregate 在空库/无索引列时可能 throw,降级到基线
      categoryMedian = null;
    }

    // 评分用的维度:这里只能用前端表单已填的;后端只是统计参考,真值在 createPost
    return generateDraft({
      key: cat,
      location: q.location,
      headcount: q.headcount ?? 1,
      salaryType: q.salaryType ?? 'fixed',
      salaryAmount: q.salaryAmount,
      seed: q.seed ?? 0,
      categoryMedian,
      sampleSize,
      // 这些维度模板生成阶段暂未填,给 false;createPost 落库后会更新评分(走 job.service 的 toPostVo)
      hasDescription: true, // 模板默认生成 description
      hasRequirements: false,
      hasQuestions: false,
      isUrgent: false,
      workPeriodsCount: 0,
    });
  }
}