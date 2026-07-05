import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

// 全局异常过滤器：统一 { code, message, traceId } 响应，不暴露堆栈
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const traceId = randomUUID();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const resp = isHttp ? (exception.getResponse() as Record<string, unknown>) : undefined;

    const code =
      typeof resp?.['code'] === 'number' ? (resp['code'] as number) : status * 100;
    const message =
      typeof resp?.['message'] === 'string'
        ? (resp['message'] as string)
        : isHttp
          ? exception.message
          : '服务繁忙，请稍后重试';

    this.logger.error(
      `[${traceId}] ${req.method} ${req.url} ${status} ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    res.status(status).json({ code, message, traceId });
  }
}
