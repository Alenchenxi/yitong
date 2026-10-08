import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnonPostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  images?: string[];

  /** P0-13 情绪分类：开心/emo/吐槽/求安慰/学习/恋爱/迷茫 */
  @IsOptional()
  @IsString()
  @MaxLength(12)
  mood?: string;

  /** P2-83 树洞视频发布（与图片互斥，服务端 createPost 强校验）；表白墙同款契约 */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoCover?: string;
}
