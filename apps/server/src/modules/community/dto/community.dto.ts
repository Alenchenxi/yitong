import { IsIn, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

// 圈子类型（广场左侧分类 + 创建必选）
export const COMMUNITY_CATEGORIES = ['校园', '兴趣', '生活', '兼职'] as const;

// 创建圈子：名称必填（1-20 字，trim 后校验），LOGO/简介可空，类型/所在地区/所在地点必填
export class CreateCommunityDto {
  @IsString()
  @Length(1, 20)
  name!: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsIn(COMMUNITY_CATEGORIES)
  category!: string;

  @IsNotEmpty()
  @IsString()
  region!: string;

  @IsNotEmpty()
  @IsString()
  location!: string;
}

// 切换当前圈子：须已是该圈子成员且圈子 ACTIVE
export class SwitchCommunityDto {
  @IsString()
  communityId!: string;
}
