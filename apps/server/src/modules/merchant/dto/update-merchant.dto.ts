import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  shopName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  contactPhone?: string;
}
