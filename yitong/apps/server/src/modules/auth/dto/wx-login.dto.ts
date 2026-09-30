import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class WxLoginDto {
  @IsString()
  @MinLength(1)
  code!: string;

  /** 选角色登录：user / merchant / admin（admin 需 openid 预设绑定） */
  @IsIn(['user', 'merchant', 'admin'])
  role!: 'user' | 'merchant' | 'admin';

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  /** 邀请码（分享拉新）：仅新用户首次注册生效 */
  @IsOptional()
  @IsString()
  referralCode?: string;
}
