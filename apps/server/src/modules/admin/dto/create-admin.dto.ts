import { IsString, MinLength } from 'class-validator';

// 添加管理员：前端传 cuid 字符串（user.id），非数字 id（schema.prisma User.id @id @default(cuid())）
export class CreateAdminDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}