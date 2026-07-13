import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

// 收藏目标类型允许：'post'（表白墙帖）/ 'anon_post'（树洞匿名帖）/ 'job_post'（兼职岗位）
export const FAVORITE_TARGET_TYPES = ['post', 'anon_post', 'job_post'] as const;
export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];

export class ToggleFavoriteDto {
  @IsString()
  @IsIn(FAVORITE_TARGET_TYPES)
  targetType!: FavoriteTargetType;

  @IsString()
  @MinLength(1)
  targetId!: string;
}

export class ListFavoritesQueryDto {
  @IsString()
  @IsIn(FAVORITE_TARGET_TYPES)
  @IsOptional()
  targetType?: FavoriteTargetType;
}