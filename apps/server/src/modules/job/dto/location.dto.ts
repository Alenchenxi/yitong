import { IsOptional, IsString, MaxLength } from 'class-validator';

// P2-79 去百度地图:geocode / poi-detail / place-suggestion / reverse-geocode / location-context
// 5 个端点整体删除(旧版客户端由 P2-78 版本更新检测覆盖),仅保留区域筛选 facets 查询。
export class LocationFacetsQueryDto {
  // 选中城市(可选):传了则附带该市全量区县列表(districts)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  city?: string;
}
