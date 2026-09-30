import { IsIn } from 'class-validator';

// 静默切换角色：已登录用户（Bearer）切换到目标角色，不需重新 wx.login
export class SwitchRoleDto {
  @IsIn(['user', 'merchant', 'admin'])
  role!: 'user' | 'merchant' | 'admin';
}
