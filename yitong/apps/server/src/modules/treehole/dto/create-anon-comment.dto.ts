import { IsString, MaxLength, MinLength } from 'class-validator';

// 树洞匿名评论创建（平铺无回复，仅 content）
export class CreateAnonCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}
