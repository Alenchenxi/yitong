import { Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import { UploadService, ALLOWED_UPLOAD_TYPES, type UploadType } from './upload.service';
import type { MulterFile } from './types';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// 图片上传：需登录（非 @Public）。仅图片，≤5MB。
// query.type 指定桶内文件夹（posts/anon/avatars/merchant/common），默认 common。
// 返回 { url } 供发帖等接口引用。90004 = 上传文件无效。
@Controller('uploads')
export class UploadController {
  constructor(private readonly upload: UploadService) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 上传 10/min
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async uploadFile(
    @UploadedFile() file: MulterFile | undefined,
    @Query('type') type?: string,
  ) {
    if (!file) throw new BizException(90004, '文件不能为空');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BizException(90004, '仅支持 jpg/png/webp/gif 图片');
    }
    const t: UploadType = (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(type ?? '')
      ? (type as UploadType)
      : 'common';
    const url = await this.upload.uploadImage(file, t);
    return ok({ url });
  }
}
