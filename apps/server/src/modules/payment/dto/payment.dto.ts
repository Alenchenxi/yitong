import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PublishJobDto {
  @IsString()
  @MinLength(1)
  jobPostId!: string;

  @IsIn(['D30', 'D90'])
  duration!: 'D30' | 'D90';
}

export class RefundPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
