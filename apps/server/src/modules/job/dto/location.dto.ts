import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

export class PlaceSuggestionQueryDto {
  @IsString()
  @MaxLength(50)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  region?: string;
}

// 反向地理编码:坐标 → POI/地址/城市
// 坐标系:gcej02(微信 wx.getFuzzyLocation 默认)或 bd09;后端内部按需转 bd09
export class ReverseGeocodeQueryDto {
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

  @IsOptional()
  @IsIn(['gcj02', 'bd09'])
  coordType?: 'gcj02' | 'bd09';
}

export class LocationContextQueryDto extends ReverseGeocodeQueryDto {}

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