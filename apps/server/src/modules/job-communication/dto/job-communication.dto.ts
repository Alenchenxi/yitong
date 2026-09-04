import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const JOB_EXCHANGE_KINDS = ['PHONE', 'WECHAT', 'RESUME'] as const;
export type JobExchangeKind = (typeof JOB_EXCHANGE_KINDS)[number];

export class SendJobMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  clientMessageId?: string;
}

export class SendJobExchangeDto {
  @IsIn(JOB_EXCHANGE_KINDS)
  kind!: JobExchangeKind;

  @IsOptional()
  @IsString()
  @Matches(/\S/u)
  @MaxLength(100)
  clientMessageId?: string;
}

export class ParseMeetingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  input!: string;
}

export class CreateInterviewInvitationDto {
  @IsString() @Matches(/\S/u) @MaxLength(500) meetingUrl!: string;
  @IsString() @Matches(/\S/u) @MaxLength(100) title!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true, strictSeparator: true }) meetingDate!: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) meetingTime!: string;
  @IsOptional() @IsString() @MaxLength(40) meetingNo?: string;
  @IsOptional() @IsString() @MaxLength(40) password?: string;
  @IsString() @Matches(/\S/u) @MaxLength(50) interviewerName!: string;
}
