import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
