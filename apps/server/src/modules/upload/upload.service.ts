import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS from 'cos-nodejs-sdk-v5';
import { randomUUID } from 'node:crypto';
import { BizException } from '../../common/exceptions/biz.exception';
import type { MulterFile } from './types';

// COS 图片上传：开发环境未配置 COS 凭证时返回 mock URL，便于本地联调（与 auth 的 mock 策略一致）。
// 上传本身不做内容安全检测——按 API 规范 §10，msgSecCheck/imgSecCheck 在发帖/评论接口内联调用。
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly cos: COS | null = null;
  private readonly bucket?: string;
  private readonly region?: string;

  constructor(private readonly config: ConfigService) {
    const secretId = this.config.get<string>('COS_SECRET_ID');
    const secretKey = this.config.get<string>('COS_SECRET_KEY');
    const bucket = this.config.get<string>('COS_BUCKET');
    const region = this.config.get<string>('COS_REGION');
    if (secretId && secretKey && bucket && region) {
      this.cos = new COS({ SecretId: secretId, SecretKey: secretKey });
      this.bucket = bucket;
      this.region = region;
    }
  }

  async uploadImage(file: MulterFile): Promise<string> {
    if (!this.cos || !this.bucket || !this.region) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, 'COS 未配置，上传不可用');
      }
      this.logger.warn('COS credentials not set; returning mock url for dev');
      return `https://mock-cos.example.com/${randomUUID()}/${file.originalname}`;
    }

    const ext = this.getExt(file.originalname);
    const today = new Date().toISOString().slice(0, 10);
    const key = `images/${today}/${randomUUID()}${ext}`;
    try {
      await this.cos.putObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });
    } catch (e) {
      this.logger.error(`COS upload failed: ${(e as Error).message}`);
      throw new BizException(90003, '文件上传失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
  }

  private getExt(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
  }
}
