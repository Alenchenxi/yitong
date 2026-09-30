import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// P1-06 搜索用户昵称
export class SearchUsersQueryDto {
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
}
