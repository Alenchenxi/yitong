import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// 商家驳回后重新提交资质 DTO
// 校验规则与 RegisterMerchantDto 完全一致（shop/license 必填 1-50 字，phone /^1\d{10}$/）
// 不复用 RegisterMerchantDto 以避免后续规则分叉时的耦合
export class ReapplyMerchantDto {
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
