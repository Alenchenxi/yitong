import { IsArray, ArrayMinSize, ArrayMaxSize, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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

  // P0-19 任职要求（可空，与工作内容分开）
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  salary!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location!: string;

  // 智能生成流程(2026-08-10):工作地点强制地图选点,4 字段必填,缺一抛 40003
  // 老数据兼容:4 字段可空(snapshot 模式);新创建岗位必须传齐
  @IsOptional()
  @IsString()
  @MaxLength(64)
  locationPoiId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locationCity?: string;

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

  // P0-21 报名问题（商家设置，报名时必答）
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questions?: string[];

  @IsIn(['D30', 'D90'])
  duration!: 'D30' | 'D90';
}

// M3-04 编辑岗位：所有字段 optional（duration 不可改，由 service 校验）
export class UpdateJobPostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requirements?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  salary?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location?: string;

  // 智能生成流程(2026-08-10):编辑模式 location 4 字段可选;前端传齐才更新
  @IsOptional()
  @IsString()
  @MaxLength(64)
  locationPoiId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locationCity?: string;

  @IsOptional()
  @IsIn(JOB_CATEGORY_VALUES)
  category?: (typeof JOB_CATEGORY_VALUES)[number];

  @IsOptional()
  @IsIn(SETTLEMENT_VALUES)
  settlement?: (typeof SETTLEMENT_VALUES)[number];

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questions?: string[];
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

  /** P0-18 关键词（匹配 title / description，不区分大小写） */
  @IsOptional()
  @IsString()
  keyword?: string;

  /** P0-18 分类 */
  @IsOptional()
  @IsIn([...JOB_CATEGORY_VALUES])
  category?: string;

  /** P0-18 结算方式 */
  @IsOptional()
  @IsIn([...SETTLEMENT_VALUES])
  settlement?: string;

  /** P0-18 工作地点（contains，不区分大小写） */
  @IsOptional()
  @IsString()
  location?: string;

  /** P0-18 薪资下限（按 salaryAmount 过滤） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  /** P0-18 薪资上限（按 salaryAmount 过滤） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  /** P0-18 online=1 只返回可线上岗位 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  online?: number;

  /** M3-03 商家岗位状态筛选（仅 mine=1 时生效；公开列表总是 PUBLISHED+未过期） */
  @IsOptional()
  @IsIn(['PENDING', 'PUBLISHED', 'TAKEN_DOWN', 'EXPIRED'])
  status?: 'PENDING' | 'PUBLISHED' | 'TAKEN_DOWN' | 'EXPIRED';

  /** 用户端"最近"tab：按距离排序，需配合 userLng/userLat */
  @IsOptional()
  @IsIn(['nearest'])
  sort?: 'nearest';

  /** 用户当前经度（sort=nearest 时必传，GCJ-02 坐标） */
  @IsOptional()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  userLng?: number;

  /** 用户当前纬度（sort=nearest 时必传，GCJ-02 坐标） */
  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  userLat?: number;
}

// M3-07 单岗位 stats 端点 query：range=day|week|month|all（非法值回退 all，由 service 兜底而非 @IsIn）
export class JobPostStatsQueryDto {
  @IsOptional()
  @IsString()
  range?: string = 'all';
}

export class TransitionDto {
  @IsIn(['accept', 'complete', 'reject'])
  action!: 'accept' | 'complete' | 'reject';
}

// P0-23 批量录用/拒绝
export class BatchTransitionDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['accept', 'reject'])
  action!: 'accept' | 'reject';
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

// P0-19 举报岗位（创建 ModerationRecord，管理员审核队列可见）
export class ReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

// P0-21 报名：可附简历 + 回答问题（answers 与 post.questions 顺序对齐）
export class ApplyDto {
  @IsOptional()
  @IsString()
  resumeId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  answers?: string[];
}

// P0-21 简历 upsert（一人一份）
export class UpsertResumeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  selfIntro?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availabilities?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  experience?: string;
}

// M3-08 曝光上报 DTO：前端 onShow 批量上报当前可见岗位 ID，后端按 (postId, userId, hourBucket) 去重
export class RecordImpressionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  postIds!: string[];
}
