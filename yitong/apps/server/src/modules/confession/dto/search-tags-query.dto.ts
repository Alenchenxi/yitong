import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// P1-07 搜索话题/标签
export class SearchTagsQueryDto {
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
