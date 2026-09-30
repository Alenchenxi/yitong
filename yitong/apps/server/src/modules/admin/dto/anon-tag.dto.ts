import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

// P1-13 树洞标签库管理
export class CreateAnonTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  name!: string;

  // personality | interest | mood
  @IsString()
  category!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAnonTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
