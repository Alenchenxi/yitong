import { IsOptional, IsString } from 'class-validator';
import { ModerationContextDto } from './moderation-context.dto';

export class ListReportsQueryDto extends ModerationContextDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
