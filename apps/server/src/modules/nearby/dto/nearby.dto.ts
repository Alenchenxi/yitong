import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class NearbyLocationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}

export class NearbyListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
