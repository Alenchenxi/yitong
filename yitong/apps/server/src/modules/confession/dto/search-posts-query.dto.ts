import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// P1-05 搜索帖子内容
export class SearchPostsQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // 内容搜索按圈子过滤（content-search 页传递当前圈子 id）
  @IsOptional()
  @IsString()
  communityId?: string;
}
