import { IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePricingDto {
  @IsIn(['D30', 'D90'])
  duration!: 'D30' | 'D90';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}
