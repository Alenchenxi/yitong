import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// P1-28 举报处理：approve=举报成立 / reject=举报驳回；takedown=true 时下架目标内容
export class ResolveReportDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  result?: string;

  @IsOptional()
  @IsBoolean()
  takedown?: boolean;
}
