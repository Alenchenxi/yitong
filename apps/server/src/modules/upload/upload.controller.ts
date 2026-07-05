import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ok } from '../../common/dto/api-response';
import { BizException } from '../../common/exceptions/biz.exception';
import { UploadService } from './upload.service';
import type { MulterFile } from './types';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// 图片上传：需登录（非 @Public）。仅图片，≤5MB。返回 { url } 供发帖等接口引用。
// 90004 = 上传文件无效（空 / 格式不支持），属 9xxxx 系统段新增（API 规范 §3 原列 90001/90002/90003）
@Controller('uploads')
export class UploadController {
  constructor(private readonly upload: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async uploadFile(@UploadedFile() file: MulterFile | undefined) {
    if (!file) throw new BizException(90004, '文件不能为空');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BizException(90004, '仅支持 jpg/png/webp/gif 图片');
    }
    const url = await this.upload.uploadImage(file);
    return ok({ url });
  }
}
