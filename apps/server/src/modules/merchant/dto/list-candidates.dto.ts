import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// M2-01 跨岗位候选人聚合查询（与 schema.prisma AppStatus 对齐）
export const APP_STATUS_VALUES = ['PENDING', 'ACCEPTED', 'DONE', 'CANCELLED', 'REJECTED'] as const;

export class ListCandidatesDto {
  /** 按岗位过滤（仅商家自己的岗位；传不属于自己的岗位会查不到数据） */
  @IsOptional()
  @IsString()
  jobPostId?: string;

  /** 按报名状态过滤 */
  @IsOptional()
  @IsIn([...APP_STATUS_VALUES])
  status?: (typeof APP_STATUS_VALUES)[number];

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
