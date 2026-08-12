import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

// 创建圈子：名称必填（1-20 字，trim 后校验），LOGO/简介可空
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
}

// 切换当前圈子：须已是该圈子成员且圈子 ACTIVE
export class SwitchCommunityDto {
  @IsString()
  communityId!: string;
}
