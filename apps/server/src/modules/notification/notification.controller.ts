import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notification: NotificationService) {}

  @Get('subscribe-templates')
  async subscribeTemplates() {
    return ok(this.notification.getSubscribeTemplates());
  }

  // M4-01 各分类未读数（供前端 tab 角标）
  @Get('unread-counts')
  async unreadCounts(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.notification.unreadCountByCategory(uid));
  }

  @Get()
  async list(
    @Query('unreadOnly') unreadOnly?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const validCategories = ['apply', 'system', 'order'] as const;
    const cat = validCategories.find((c) => c === category);
    return ok(
      await this.notification.list(
        uid,
        unreadOnly === '1',
        parsePositiveInt(page, 1, 1, 10_000),
        parsePositiveInt(pageSize, 20, 1, 50),
        cat,
      ),
    );
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.notification.markRead(id, uid));
  }

  @Post('read-all')
  async markAllRead(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.notification.markAllRead(uid));
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
