import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface ImCredential {
  loginUserId: string;
  loginToken: string;
  wsUrl: string;
}

// IM 适配层（自建 ws 版）：签发 WebSocket 登录凭证。
// identifier = uid（实名：客服/岗位）或 anonId（树洞匿名）。
// loginToken 由 JwtService 签发（type=ws，1h），ChatGateway 连接时校验。
@Injectable()
export class ImService {
  private readonly wsUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.wsUrl = this.config.get<string>('CHAT_WS_URL') ?? 'ws://localhost:3001';
  }

  async getImCredential(identifier: string): Promise<ImCredential> {
    const loginToken = await this.jwt.signAsync(
      { identifier, type: 'ws' },
      { expiresIn: '1h' },
    );
    return { loginUserId: identifier, loginToken, wsUrl: this.wsUrl };
  }
}
