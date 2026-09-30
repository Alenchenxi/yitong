import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  backgroundImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
