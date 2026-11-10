import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// 活动模块入参 DTO（specs/features/活动模块.md §4.2/4.3）

export class ActivityFormFieldDto {
  @IsOptional()
  @IsString()
  key?: string; // 编辑时携带；新建由服务端生成

  @IsIn(['text', 'textarea', 'radio', 'checkbox', 'date', 'phone', 'wechat', 'image'])
  type!: string;

  @IsString()
  @Length(1, 30)
  label!: string;

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  placeholder?: string;

  @IsOptional()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  options?: string[];

  @IsInt()
  @Min(0)
  order!: number;
}

class SaveActivityDto {
  @IsString()
  @Length(1, 50)
  title!: string;

  @IsString()
  @IsNotEmpty()
  coverImage!: string;

  @IsString()
  @Length(1, 5000)
  description!: string;

  @IsIn(['OFFLINE', 'ONLINE', 'HYBRID'])
  format!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  joinLink?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'APPROVED_ONLY'])
  infoVisibility?: string;

  @IsOptional()
  @IsString()
  startTime?: string; // ISO；空 = 长期活动

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  enrollStartAt?: string;

  @IsOptional()
  @IsString()
  enrollEndAt?: string;

  @IsIn(['DIRECT', 'REVIEW'])
  joinMode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested()
  @Type(() => ActivityFormFieldDto)
  form?: ActivityFormFieldDto[];
}

export class CreateActivityDto extends SaveActivityDto {
  @IsOptional()
  @IsString()
  communityId?: string; // 圈子活动必填且须是自己管理的圈子；平台活动不传

  @IsOptional()
  @IsBoolean()
  publish?: boolean; // true = 直接发布（默认仅存草稿）
}

export class UpdateActivityDto extends SaveActivityDto {
}

export class EnrollActivityDto {
  @IsObject()
  data!: Record<string, unknown>; // { [fieldKey]: string | string[] }
}

export class UpdateEnrollmentDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class ReviewEnrollmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string; // 拒绝原因（通知用户）
}

export class RevokeEnrollmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string; // 取消资格必填原因（AC-023）
}

export class SetInterestDto {
  @IsIn(['INTERESTED', 'NOT_INTERESTED', ''])
  state!: string; // '' = 恢复（清除标记）
}

export class RemindDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  targetUserIds?: string[]; // 不传 = 全部正式参与人
}

export class SetActivityAdminsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  add?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  remove?: string[];
}

export class TransferInitiatorDto {
  @IsString()
  @IsNotEmpty()
  targetUserId!: string;
}

export class SetLarkConfigDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bitableApp!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bitableTable!: string;
}

export class CreateLarkConnectionDto {
  @IsString()
  @Length(1, 30)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  appSecret!: string;
}

export class ListActivitiesDto {
  @IsOptional()
  @IsString()
  status?: string; // 单个状态或逗号分隔；缺省 = 可见的有效活动

  @IsOptional()
  @IsString()
  communityId?: string; // 缺省 = 用户当前圈子

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ListMyActivitiesDto {
  @IsIn(['interested', 'enrolled', 'pending', 'waitlist', 'cancelled', 'ended', 'not_interested'])
  tab!: string;
}
