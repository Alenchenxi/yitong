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
}
