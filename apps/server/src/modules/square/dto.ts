import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// 广场 union feed sort 白名单：recommend | latest（关注流不暴露，留在表白墙 /posts/feed?sort=follow）
export type SquareFeedSort = 'recommend' | 'latest';

export class SquareFeedQueryDto {
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
  @IsIn(['recommend', 'latest'])
  sort?: SquareFeedSort = 'recommend';

  // 圈子（Community）作用域：缺省取用户当前圈子
  @IsOptional()
  @IsString()
  communityId?: string;
}

// 今日上头：近24h 浏览量 TopN（默认 10，max 50）
export class SquareTodayHitQueryDto {
  @IsOptional()
  @IsString()
  communityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
