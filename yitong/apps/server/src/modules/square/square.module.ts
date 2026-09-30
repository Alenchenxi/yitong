import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SquareController } from './square.controller';
import { SquareService } from './square.service';

// CR-001 广场混合流模块（扩展为圈子广场数据模块）
// TreeholeModule 是 @Global()，TreeholeService 可直接注入，无需显式 import
// CommunityModule 是 @Global()，CommunityService 可直接注入（当前圈子/浏览量/今日上头）
// ConfigModule 是 global（app.module isGlobal:true），ConfigService 可直接注入
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // 复用 auth.module 同一 JWT_SECRET（anon token 由 auth 签发，square 解析）
        const secret = config.get<string>('JWT_SECRET');
        return { secret: secret || 'dev-secret-change-me' };
      },
    }),
  ],
  controllers: [SquareController],
  providers: [SquareService],
  exports: [SquareService],
})
export class SquareModule {}
