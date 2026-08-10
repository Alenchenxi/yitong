import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GeocodeQueryDto {
  @IsString()
  @MaxLength(100)
  address!: string;
}

export class PoiDetailQueryDto {
  @IsString()
  @MaxLength(64)
  poiId!: string;
}

export class PoiInfoVo {
  poiId!: string;
  address!: string;
  lng!: number;
  lat!: number;
  city!: string;
}

export class CreateJobPostLocationExtension {
  @IsString()
  @MaxLength(64)
  locationPoiId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  locationLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  locationLat!: number;

  @IsString()
  @MaxLength(20)
  locationCity!: string;

  // 可选:百度地图反查得到的精确文本(覆盖前端反查结果)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationAddress?: string;
}