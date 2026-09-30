import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnonPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  images?: string[];

  /** P0-13 情绪分类：开心/emo/吐槽/求安慰/学习/恋爱/迷茫 */
  @IsOptional()
  @IsString()
  @MaxLength(12)
  mood?: string;
}
