import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // rawBody=true：微信支付/退款回调验签需要原始请求体（req.rawBody）
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();
  const port = Number(config.get<string>('PORT')) || 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 server on http://localhost:${port}/api/v1`);
}

bootstrap();
