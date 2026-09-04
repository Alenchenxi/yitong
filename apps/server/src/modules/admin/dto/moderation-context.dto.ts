import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export const MODERATION_SCOPES = ['PLATFORM', 'COMMUNITY'] as const;
export type ModerationScope = (typeof MODERATION_SCOPES)[number];

export class ModerationContextDto {
  @IsOptional()
  @IsIn(MODERATION_SCOPES)
  scope?: ModerationScope;

  @IsOptional()
  @IsString()
  communityId?: string;
}

export class RestoreModeratedContentDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class ModerateUserDto extends ModerationContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
