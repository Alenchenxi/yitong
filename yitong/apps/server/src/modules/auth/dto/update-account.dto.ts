import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  nickname?: string;

  @IsOptional()
  @IsString()
  gender?: string; // male / female / other

  @IsOptional()
  @IsString()
  birthday?: string; // YYYY-MM-DD
  @IsOptional()
  @IsString()
  @Matches(/^$|^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^$|^\S+$/, { message: '微信号不能包含空格' })
  wechat?: string;
}
