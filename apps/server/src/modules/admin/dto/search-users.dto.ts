import { IsString, MaxLength, MinLength } from 'class-validator';

// 搜索候选用户（添加管理员用）：keyword 必填（前端空输入已拦截，后端强制最小 1 字符，避免无关键词返回全量）
export class SearchUsersDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  keyword!: string;
}