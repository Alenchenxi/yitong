import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notification: NotificationService) {}

  @Get()
  async list(
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(
      await this.notification.list(
        uid,
        unreadOnly === '1',
        page ? Number(page) : 1,
        pageSize ? Number(pageSize) : 20,
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
