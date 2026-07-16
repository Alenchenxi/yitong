import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WxAccessTokenService } from './wx-access-token.service';

export interface SubscribeTemplateConfig {
  jobApply: string | null;
  jobStatus: string | null;
  tmplIds: string[];
}

interface SubscribeSendResp {
  errcode?: number;
  errmsg?: string;
}

export interface SubscribeNotificationPayload {
  openid: string;
  type: string;
  title: string;
  content: string;
  targetType?: string | null;
  targetId?: string | null;
  createdAt?: Date;
}

@Injectable()
export class WxSubscribeMessageService {
  private readonly logger = new Logger(WxSubscribeMessageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly wxToken: WxAccessTokenService,
  ) {}

  getTemplates(): SubscribeTemplateConfig {
    const jobApply = this.config.get<string>('WX_SUBSCRIBE_JOB_APPLY_TEMPLATE_ID') || null;
    const jobStatus = this.config.get<string>('WX_SUBSCRIBE_JOB_STATUS_TEMPLATE_ID') || null;
    return {
      jobApply,
      jobStatus,
      tmplIds: [jobApply, jobStatus].filter((id): id is string => !!id),
    };
  }

  async sendForNotification(payload: SubscribeNotificationPayload) {
    if (this.wxToken.isMock()) {
      this.logger.warn('WX credentials not set; skip subscribe message in dev');
      return;
    }

    const templateId = this.templateIdFor(payload.type);
    if (!templateId) {
      this.logger.warn(`subscribe template not configured for notification type ${payload.type}`);
      return;
    }

    const accessToken = await this.wxToken.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: payload.openid,
        template_id: templateId,
        page: this.pageFor(payload),
        miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'developer',
        lang: 'zh_CN',
        data: this.dataFor(payload),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      this.logger.warn(`subscribe message send failed: HTTP ${res.status}`);
      return;
    }

    const data = (await res.json()) as SubscribeSendResp;
    if (data.errcode && data.errcode !== 0) {
      this.logger.warn(`subscribe message send failed: ${data.errcode} ${data.errmsg ?? ''}`);
    }
  }

  private templateIdFor(type: string) {
    const templates = this.getTemplates();
    if (type === 'job_apply') return templates.jobApply;
    if (type === 'job_accept' || type === 'job_complete') return templates.jobStatus;
    return null;
  }

  private pageFor(payload: SubscribeNotificationPayload) {
    if (payload.targetType === 'job_post' && payload.targetId) {
      return `pages/job/detail/index?id=${encodeURIComponent(payload.targetId)}`;
    }
    if (payload.targetType === 'application') {
      return 'pages/job/my-applications/index';
    }
    return 'pages/notifications/index';
  }

  private dataFor(payload: SubscribeNotificationPayload) {
    const time = formatDate(payload.createdAt ?? new Date());
    if (payload.type === 'job_apply') {
      return {
        thing1: { value: truncate(payload.title, 20) },
        thing2: { value: truncate(payload.content, 20) },
        time3: { value: time },
      };
    }
    return {
      thing1: { value: truncate(payload.title, 20) },
      phrase2: { value: payload.type === 'job_accept' ? '已录用' : '已完成' },
      thing3: { value: truncate(payload.content, 20) },
      time4: { value: time },
    };
  }
}

function truncate(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function formatDate(date: Date) {
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
