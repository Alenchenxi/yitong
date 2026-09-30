// multer 内存存储下的文件结构（仅取上传所需字段，避免依赖 @types/multer 的全局命名空间）。
// Nest FileInterceptor 默认 memoryStorage，文件内容在 file.buffer。
export interface MulterFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
