import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class JobTemplateQueryDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount?: number = 1;

  @IsOptional()
  @IsIn(['fixed', 'range'])
  salaryType?: 'fixed' | 'range' = 'fixed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seed?: number = 0;
}

export class AttractivenessVo {
  score!: number;
  percentile!: number;
  label!: string;
}

export class JobTemplateResponseVo {
  title!: string;
  description!: string;
  salary!: string;
  settlementHint!: string;
  categoryMapTo!: string | null;
  attractiveness!: AttractivenessVo;
  refreshCount!: number;
  nextSeed!: number;
}