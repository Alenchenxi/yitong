import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { AdminGuard } from '../auth/admin.guard';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcement: AnnouncementService) {}

  // 公开列表（仅 active，登录用户可看）
  @Get()
  async list(@Req() req: Request) {
    // 任何登录用户可看（JwtAuthGuard 已校验）
    return ok(await this.announcement.listActive());
  }

  // 管理员接口
  @UseGuards(AdminGuard)
  @Get('all')
  async listAll() {
    return ok(await this.announcement.listAll());
  }

  @UseGuards(AdminGuard)
  @Post()
  async create(@Body() dto: CreateAnnouncementDto) {
    return ok(await this.announcement.create(dto));
  }

  @UseGuards(AdminGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return ok(await this.announcement.update(id, dto));
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return ok(await this.announcement.delete(id));
  }
}
