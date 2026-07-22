import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  peerId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  // P1-18 消息类型：text / image / voice（缺省 text）
  @IsOptional()
  @IsIn(['text', 'image', 'voice'])
  type?: string;

  // P1-18 语音时长（秒，1-60），仅 type=voice 必填
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  duration?: number;
}
