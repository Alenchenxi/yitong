import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import { BizException } from '../../common/exceptions/biz.exception';
import type { MulterFile } from './types';

// 允许的上传类型（桶内文件夹名）：common 兜底，posts 表白墙帖，anon 树洞匿名帖，avatars 头像，merchant 商家资质，voice 语音消息
export const ALLOWED_UPLOAD_TYPES = ['common', 'posts', 'anon', 'avatars', 'merchant', 'voice'] as const;
export type UploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

// MinIO 图片上传：单桶，按 type 分文件夹（type/date/uuid.ext）。
// 桶设 public read（图片可公开访问，URL = ${MINIO_PUBLIC_URL}/${bucket}/${key}）。
// dev 未配置 MinIO 时返回 mock URL（与 auth mock 策略一致）。
@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private readonly client: Client | null = null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const endPointRaw = this.config.get<string>('MINIO_ENDPOINT') ?? '';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');
    const bucket = this.config.get<string>('MINIO_BUCKET') ?? 'yitong';
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    // endPoint 支持 "host:port" 或纯 host；端口也可用 MINIO_PORT 单独指定
    const [endPoint, portFromHost] = endPointRaw.split(':');
    const port = Number(portFromHost) || Number(this.config.get<string>('MINIO_PORT')) || (useSSL ? 443 : 9000);
    this.bucket = bucket;
    this.publicUrl = this.config.get<string>('MINIO_PUBLIC_URL') ?? `http://${endPointRaw}`;
    if (endPoint && accessKey && secretKey) {
      this.client = new Client({ endPoint, port, useSSL, accessKey, secretKey });
    }
  }

  async onModuleInit() {
    if (!this.client) {
      this.logger.warn('MinIO not configured; upload returns mock url in dev');
      return;
    }
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`created bucket ${this.bucket}`);
      }
      // 桶设 public read（s3:GetObject 对所有人开放），图片可直接通过 URL 访问
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
    } catch (e) {
      this.logger.error(`MinIO init failed: ${(e as Error).message}`);
    }
  }

  async uploadImage(file: MulterFile, type: UploadType = 'common'): Promise<string> {
    return this.store(file, type);
  }

  // 视频上传：同 putObject，mimetype/大小由控制器侧校验（mp4 ≤50MB）
  async uploadVideo(file: MulterFile, type: UploadType = 'common'): Promise<string> {
    return this.store(file, type);
  }

  // P1-18 语音上传：同 putObject，mimetype/大小由控制器侧校验（mp3/m4a/aac/wav ≤2MB）
  async uploadVoice(file: MulterFile, type: UploadType = 'voice'): Promise<string> {
    return this.store(file, type);
  }

  private async store(file: MulterFile, type: UploadType): Promise<string> {
    if (!this.client) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, 'MinIO 未配置，上传不可用');
      }
      this.logger.warn('MinIO not set; returning mock url for dev');
      return `https://mock-minio.example.com/${type}/${randomUUID()}/${file.originalname}`;
    }

    const ext = this.getExt(file.originalname);
    const today = new Date().toISOString().slice(0, 10);
    const key = `${type}/${today}/${randomUUID()}${ext}`;
    try {
      await this.client.putObject(this.bucket, key, file.buffer, file.size, {
        'Content-Type': file.mimetype,
      });
    } catch (e) {
      this.logger.error(`MinIO upload failed: ${(e as Error).message}`);
      throw new BizException(90003, '文件上传失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }

  private getExt(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
  }
}
