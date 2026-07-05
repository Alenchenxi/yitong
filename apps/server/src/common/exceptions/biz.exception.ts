import { HttpException, HttpStatus } from '@nestjs/common';

// 业务异常：携带业务错误码（与 API 设计规范 §3 对齐），由全局 AllExceptionsFilter 统一包装
export class BizException extends HttpException {
  constructor(
    public readonly bizCode: number,
    message: string,
    status = HttpStatus.BAD_REQUEST,
  ) {
    super({ code: bizCode, message }, status);
  }
}
