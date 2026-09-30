import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBoostPlanPriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}
