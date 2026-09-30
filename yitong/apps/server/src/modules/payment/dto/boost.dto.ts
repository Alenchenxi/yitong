import { IsIn, IsNumber, IsString, Min, MinLength } from 'class-validator';

// 内容推广下单：targetType 目标类型（post 表白墙 / anon_post 树洞），金额服务端按 BoostPlan 算
export class CreateBoostOrderDto {
  @IsIn(['post', 'anon_post'])
  targetType!: 'post' | 'anon_post';

  @IsString()
  @MinLength(1)
  targetId!: string;

  @IsString()
  @MinLength(1)
  planCode!: string;
}

// 后台改推广档位价格
export class UpdateBoostPlanPriceDto {
  @IsNumber()
  @Min(0)
  price!: number;
}
