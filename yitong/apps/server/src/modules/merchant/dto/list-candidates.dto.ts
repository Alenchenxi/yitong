import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// M2-01 跨岗位候选人聚合查询（与 schema.prisma AppStatus 对齐）
export const APP_STATUS_VALUES = ['PENDING', 'ACCEPTED', 'DONE', 'CANCELLED', 'REJECTED'] as const;
// M2-05 合适度标记（与 schema.prisma FitMark 对齐）
export const FIT_MARK_VALUES = ['FIT', 'UNFIT'] as const;
export const INTERVIEW_STATUS_VALUES = ['ACCEPTED'] as const;

export class ListCandidatesDto {
  /** 按岗位过滤（仅商家自己的岗位；传不属于自己的岗位会查不到数据） */
  @IsOptional()
  @IsString()
  jobPostId?: string;

  /** 按报名状态过滤 */
  @IsOptional()
  @IsIn([...APP_STATUS_VALUES])
  status?: (typeof APP_STATUS_VALUES)[number];

  /** 邀约维度筛选；ACCEPTED 表示用户已接受且报名仍有效。 */
  @IsOptional()
  @IsIn([...INTERVIEW_STATUS_VALUES])
  interviewStatus?: (typeof INTERVIEW_STATUS_VALUES)[number];

  /** M2-04 按已联系过滤：1=已联系，0=未联系 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  contacted?: number;

  /** M2-05 按合适度标记过滤：FIT=合适，UNFIT=不合适 */
  @IsOptional()
  @IsIn([...FIT_MARK_VALUES])
  fitMark?: (typeof FIT_MARK_VALUES)[number];

  /** 关键词（匹配学生昵称 / 岗位标题，不区分大小写） */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}

// M2-04 标记已联系（contacted=true 置时间，false 清除）
export class MarkContactedDto {
  @IsIn([true, false])
  contacted!: boolean;
}

// M2-05 标记合适/不合适（fitMark 为 FIT/UNFIT 设置，null 清除）
export class MarkFitDto {
  @IsIn([...FIT_MARK_VALUES, null])
  fitMark!: (typeof FIT_MARK_VALUES)[number] | null;
}

// M2-06 批量标记
export class BatchMarkDto {
  @IsString({ each: true })
  ids!: string[];

  /** 标记类型：contacted=已联系，fit=合适度 */
  @IsIn(['contacted', 'fit'])
  mark!: 'contacted' | 'fit';

  /** mark=contacted 时必填：true 置已联系，false 清除 */
  @IsOptional()
  @IsIn([true, false])
  contacted?: boolean;

  /** mark=fit 时必填：FIT/UNFIT 设置，null 清除 */
  @IsOptional()
  @IsIn([...FIT_MARK_VALUES, null])
  fitMark?: (typeof FIT_MARK_VALUES)[number] | null;
}

// M2-03 看过我列表查询
export class ListViewersDto {
  @IsOptional()
  @IsString()
  jobPostId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}
