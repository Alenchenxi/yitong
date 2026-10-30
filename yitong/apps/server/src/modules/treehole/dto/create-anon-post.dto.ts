import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  /** CR-006 发布地：选点地址文本（服务端解析市/区落库，不存坐标——匿名红线） */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  locationAddress?: string;

  /** CR-007 可见性：公开/私密（私密仅作者可见，跳内容审核；树洞无草稿，不支持 DRAFT） */
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'PRIVATE';
}
