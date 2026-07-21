import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

// P0-17 岗位分类 / 结算方式枚举值（与 schema.prisma JobCategory / Settlement 对齐）
export const JOB_CATEGORY_VALUES = [
  'CATERING',
  'RETAIL',
  'PROMOTION',
  'EXHIBITION',
  'TUTORING',
  'CAMPUS_AGENT',
  'ONLINE',
  'SURVEY',
  'INTERNSHIP',
  'LONG_TERM',
] as const;
export const SETTLEMENT_VALUES = ['DAILY', 'WEEKLY', 'MONTHLY', 'COMPLETION'] as const;
// P0-17 工作日期 / 工作时段白名单（结构化，防任意文本）
export const WORK_DATE_VALUES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日', '可商议'] as const;
export const WORK_PERIOD_VALUES = ['上午', '下午', '晚上', '全天', '可商议'] as const;

export class CreateJobPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  salary!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location!: string;

  // P0-17 结构化字段第一批
  @IsIn(JOB_CATEGORY_VALUES)
  category!: (typeof JOB_CATEGORY_VALUES)[number];

  @IsIn(SETTLEMENT_VALUES)
  settlement!: (typeof SETTLEMENT_VALUES)[number];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workDates?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workPeriods?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  headcount?: number;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @IsOptional()
  @IsBoolean()
  online?: boolean;

  @IsIn(['D30', 'D90'])
  duration!: 'D30' | 'D90';
}

export class JobListQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  /** mine=1 时返回当前商家自己的岗位（含草稿），需商家角色 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  mine?: number;

  /** P0-17 urgent=1 只返回急招岗位（status=PUBLISHED 且 urgent=true） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  urgent?: number;
}

export class TransitionDto {
  @IsIn(['accept', 'complete'])
  action!: 'accept' | 'complete';
}

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}
