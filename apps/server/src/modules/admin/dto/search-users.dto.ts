import { IsOptional, IsString, MaxLength } from 'class-validator';

// 搜索候选用户（添加管理员用）：可选昵称模糊筛
export class SearchUsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}