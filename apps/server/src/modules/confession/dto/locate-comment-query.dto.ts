import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

// P1-01 评论跳转定位查询：目标评论 + 前端分页大小（与列表 pageSize 保持一致）
export class LocateCommentQueryDto {
  @IsString()
  @IsNotEmpty()
  commentId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
