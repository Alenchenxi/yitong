import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class WxLoginDto {
  @IsString()
  @MinLength(1)
  code!: string;

  /** role 仅用于选择对应小程序的 AppID/Secret（用户端 / 商家端） */
  @IsIn(['user', 'merchant'])
  role!: 'user' | 'merchant';

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
