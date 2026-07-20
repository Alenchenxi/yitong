import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type FeedSort = 'latest' | 'hot' | 'recommend' | 'follow';

// 游标分页：cursor 为上一页末尾条目的游标（base64url JSON），limit 1-50，sort 排序
export class FeedQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['latest', 'hot', 'recommend', 'follow'])
  sort?: FeedSort = 'latest';
}
