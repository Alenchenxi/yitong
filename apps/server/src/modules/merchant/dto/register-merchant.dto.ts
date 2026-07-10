import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterMerchantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  shopName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  licenseNo!: string;

  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  contactPhone!: string;
}
