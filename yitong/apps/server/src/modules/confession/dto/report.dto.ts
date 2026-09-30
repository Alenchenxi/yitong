import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
