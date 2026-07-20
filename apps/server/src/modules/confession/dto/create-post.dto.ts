import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// 发帖：文字必填（1-2000），图片可选（最多 9 张，传已上传的 COS URL）
// P0-09 增强：标签（最多 5 个，每个 1-12 字）、匿名/实名、视频（URL+封面）
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(12, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  // 视频 URL / 封面 URL（已上传的 COS URL）；与 images 一致用 IsString，避免本地/mock URL 的 IsUrl 边界
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoCover?: string;
}
