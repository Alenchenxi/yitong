// P2-26 admin 拒绝圈子原因 DTO（1-200 字符，必填）
import { IsString, Length } from 'class-validator';

export class RejectCommunityDto {
  @IsString()
  @Length(1, 200, { message: '拒绝理由 1-200 字' })
  reason!: string;
}
