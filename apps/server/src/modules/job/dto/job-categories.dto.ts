import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class JobCategoryItemVo {
  key!: string;
  label!: string;
  icon!: string;
  mapTo!: string | null;
}

export class JobCategoriesResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobCategoryItemVo)
  items!: JobCategoryItemVo[];
}