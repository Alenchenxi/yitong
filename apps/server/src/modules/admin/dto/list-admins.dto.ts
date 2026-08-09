import { IsOptional, IsString, MaxLength } from 'class-validator';

// 列管理员：可选 username/openid 模糊筛
export class ListAdminsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}