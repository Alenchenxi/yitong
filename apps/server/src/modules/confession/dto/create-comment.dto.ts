import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  /** P0-10 回复：所属顶级评论 id（不传=顶级评论；传=回复，必须指向同帖顶级评论） */
  @IsOptional()
  @IsString()
  parentId?: string;

  /** P0-10 回复：被回复的具体评论/回复 id（用于"回复@user"展示；不传=回复顶级评论作者） */
  @IsOptional()
  @IsString()
  replyToId?: string;
}
