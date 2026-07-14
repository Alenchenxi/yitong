import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJobPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  salary!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  location!: string;

  @IsIn(['D30', 'D90'])
  duration!: 'D30' | 'D90';
}

export class JobListQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  /** mine=1 时返回当前商家自己的岗位（含草稿），需商家角色 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  mine?: number;
}

export class TransitionDto {
  @IsIn(['accept', 'complete'])
  action!: 'accept' | 'complete';
}

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}
