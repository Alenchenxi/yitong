// 规则引擎:智能生成职位文案 + 吸引力评分(2026-08-10)。
// 设计:纯函数,无副作用;不持久化;不引 LLM(与功能规划.md 红线一致)。
// 调用方:job-template.service.ts 拼 DB 统计 + 调用本文件函数。

import {
  CategoryKey,
  DESCRIPTION_TEMPLATES,
  JOB_CATEGORY_GRID,
  SALARY_BASELINE,
  TITLE_TEMPLATES,
} from './job.template.data';

export interface GenerateInput {
  key: CategoryKey;
  customCategory?: string;
  location?: string;
  headcount: number;
  salaryType: 'fixed' | 'range';
  salaryAmount?: number;
  seed: number;
  // 周边 median(由 service 拼 DB 算);null 表示样本不足,走基线
  categoryMedian: number | null;
  // 用于评分
  hasDescription: boolean;
  hasRequirements: boolean;
  hasQuestions: boolean;
  isUrgent: boolean;
  workPeriodsCount: number;
}

export interface Attractiveness {
  score: number;
  percentile: number;
  label: string;
}

export interface GenerateOutput {
  title: string;
  description: string;
  salary: string;
  settlementHint: string;
  categoryMapTo: string | null;
  attractiveness: Attractiveness;
  refreshCount: number;
  nextSeed: number;
}

// 取模选第 N 条(确定性,「换一个」纯客户端 seed++)
function pickBySeed<T>(arr: T[], seed: number): T {
  if (arr.length === 0) {
    throw new Error('template pool empty');
  }
  const idx = ((seed % arr.length) + arr.length) % arr.length;
  // noUncheckedIndexedAccess: pickBySeed 已防 length=0,但 TS 仍要强断言
  return arr[idx]!;
}

function roleForKey(key: CategoryKey, customCategory?: string): string {
  if (key === 'CUSTOM' && customCategory?.trim()) return customCategory.trim();
  const entry = JOB_CATEGORY_GRID.find((c) => c.key === key);
  return entry ? entry.label : '校园兼职';
}

export function suggestTitle(input: GenerateInput): string {
  const pool = TITLE_TEMPLATES[input.key];
  const tpl = pickBySeed(pool, input.seed);
  const base = input.salaryAmount ?? SALARY_BASELINE[input.key];
  return tpl
    .replace('{role}', roleForKey(input.key, input.customCategory))
    .replace('{location}', input.location?.trim() || '学校周边')
    .replace('{base}', String(base));
}

export function suggestDescription(input: GenerateInput): string {
  const pool = DESCRIPTION_TEMPLATES[input.key];
  const seg = pickBySeed(pool, input.seed);
  return seg.join('\n');
}

export function suggestSalary(input: GenerateInput): string {
  if (input.salaryAmount && input.salaryAmount > 0) {
    return input.salaryType === 'range'
      ? `${input.salaryAmount}元/小时(面议)`
      : `${input.salaryAmount}元/小时`;
  }
  const anchor = input.categoryMedian ?? SALARY_BASELINE[input.key];
  const suggested = Math.round(anchor * 1.1);
  return `${suggested}元/小时`;
}

// 类别名转 settlement 提示(纯前端建议用,可改)
export function suggestSettlementHint(key: CategoryKey): string {
  switch (key) {
    case 'RESTAURANT':
    case 'KITCHEN':
    case 'FIELD_PROMO':
    case 'RIDESHARE':
      return 'DAILY';
    case 'PHONE_SALES':
    case 'PHONE_CS':
    case 'RETAIL_SALES':
      return 'MONTHLY';
    case 'FACTORY':
    case 'SECURITY':
      return 'MONTHLY';
    case 'OFFICE_CLERK':
    case 'HOME_STREAMER':
    case 'TUTORING':
      return 'COMPLETION';
    case 'OTHERS':
    default:
      return 'COMPLETION';
  }
}

// 吸引力评分:100 分制加权,纯规则(无 AI/无 LLM)
export function scoreAttractiveness(input: {
  salaryCompareToCategoryAnchor: number; // 1.0 = 周边中位数,1.2 = 高 20%
  hasDescription: boolean;
  hasRequirements: boolean;
  hasQuestions: boolean;
  isUrgent: boolean;
  workPeriodsCount: number;
  headcount: number;
}): number {
  let score = 0;
  const cmp = input.salaryCompareToCategoryAnchor;
  if (cmp >= 1.3) score += 35;
  else if (cmp >= 1.1) score += 25;
  else if (cmp >= 0.9) score += 15;
  else score += 5;

  if (input.hasDescription) score += 20;
  if (input.hasRequirements) score += 15;
  if (input.hasQuestions) score += 10;
  if (input.isUrgent) score += 10;
  if (input.workPeriodsCount >= 2) score += 5;
  if (input.headcount >= 1 && input.headcount <= 10) score += 5;
  return Math.min(100, score);
}

// 简陋对照表:50 分 -> 50%,80 分 -> 88%,100 分 -> 99.5%
// 已知限制:后续 A/B 校准
const SCORE_TO_PERCENTILE: ReadonlyArray<readonly [number, number]> = [
  [100, 99.5],
  [90, 95],
  [80, 88],
  [70, 75],
  [60, 60],
  [50, 50],
  [40, 35],
  [30, 20],
  [20, 10],
  [0, 5],
];

export function scoreToPercentile(score: number, sampleSize: number): number {
  // 样本 < 5 冷启动:降一档(避免假高分)
  const table = sampleSize < 5 ? SCORE_TO_PERCENTILE.slice(1) : SCORE_TO_PERCENTILE;
  for (const [s, p] of table) {
    if (score >= s) return p;
  }
  return 5;
}

export function buildAttractiveness(
  score: number,
  percentile: number,
): Attractiveness {
  return {
    score,
    percentile,
    label: `吸引力超越周边 ${percentile}% 同行`,
  };
}

// 主入口:拼装一次智能生成结果(由 service 调)
export function generateDraft(
  input: GenerateInput & { sampleSize: number },
): GenerateOutput {
  const title = suggestTitle(input);
  const description = suggestDescription(input);
  const salary = suggestSalary(input);
  const settlementHint = suggestSettlementHint(input.key);

  const anchor = input.categoryMedian ?? SALARY_BASELINE[input.key];
  const cmp =
    input.salaryAmount && input.salaryAmount > 0 ? input.salaryAmount / anchor : 1.0;

  const score = scoreAttractiveness({
    salaryCompareToCategoryAnchor: cmp,
    hasDescription: input.hasDescription,
    hasRequirements: input.hasRequirements,
    hasQuestions: input.hasQuestions,
    isUrgent: input.isUrgent,
    workPeriodsCount: input.workPeriodsCount,
    headcount: input.headcount,
  });
  const percentile = scoreToPercentile(score, input.sampleSize);

  return {
    title,
    description,
    salary,
    settlementHint,
    categoryMapTo: (JOB_CATEGORY_GRID.find((c) => c.key === input.key)?.mapTo ?? null) as string | null,
    attractiveness: buildAttractiveness(score, percentile),
    refreshCount: 1,
    nextSeed: input.seed + 1,
  };
}