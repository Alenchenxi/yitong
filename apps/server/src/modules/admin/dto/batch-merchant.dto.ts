import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class BatchMerchantDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
