import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BizException } from '../../common/exceptions/biz.exception';

export interface ImCredential {
  loginUserId: string;
  loginToken: string;
  wsUrl: string;
}

// IM 适配层：封装与 MobileIMSDK 服务端的交互。
// - 真实接入：调 MobileIMSDK 服务端 HTTP API（注册账号 / 签发 loginToken），返回 wsUrl。
// - Mock：缺 MOBILEIMSDK_WS_URL 时返回 mock 凭证，便于联调（真实消息收发需服务端）。
// 真实服务端 SDK/文档接入待获取后补（见 TODO），接口契约已定，treehole/job 可消费。
@Injectable()
export class ImService {
  private readonly logger = new Logger(ImService.name);
  private readonly wsUrl: string;
  private readonly apiUrl: string;
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    this.wsUrl = this.config.get<string>('MOBILEIMSDK_WS_URL') ?? '';
    this.apiUrl = this.config.get<string>('MOBILEIMSDK_API_URL') ?? '';
    this.secret = this.config.get<string>('MOBILEIMSDK_SECRET') ?? '';
  }

  isMock(): boolean {
    return !this.wsUrl;
  }

  // 签发 IM 登录凭证：identifier = uid（实名）或 anonId（树洞匿名）
  async getImCredential(identifier: string): Promise<ImCredential> {
    if (this.isMock()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BizException(90003, 'IM 服务未配置');
      }
      this.logger.warn('MobileIMSDK not configured; returning mock credential');
      return {
        loginUserId: identifier,
        loginToken: `mock_${identifier}_${Date.now()}`,
        wsUrl: 'ws://mock-mobileimsdk',
      };
    }
    // TODO(真实接入): 调 MobileIMSDK Node 服务端 API（this.apiUrl）注册/校验账号 + 签发 loginToken
    // 当前临时回退 mock（不阻塞联调）；生产前必须实现真实签发
    this.logger.warn('MobileIMSDK real integration TODO; returning mock credential');
    return {
      loginUserId: identifier,
      loginToken: `mock_${identifier}_${Date.now()}`,
      wsUrl: this.wsUrl,
    };
  }
}
