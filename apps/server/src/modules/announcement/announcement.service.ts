import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAnnouncementDto } from './dto/announcement.dto';
import type { UpdateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(private readonly prisma: PrismaService) {}

  // 公开列表（仅 active）
  async listActive() {
    const items = await this.prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return items.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  // 管理员列表（全部）
  async listAll() {
    const items = await this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return items.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      active: a.active,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  async create(dto: CreateAnnouncementDto) {
    const a = await this.prisma.announcement.create({
      data: { title: dto.title, content: dto.content },
    });
    return { id: a.id, title: a.title, content: a.content, active: a.active, createdAt: a.createdAt.toISOString() };
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const a = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    return { id: a.id, title: a.title, content: a.content, active: a.active, updatedAt: a.updatedAt.toISOString() };
  }

  async delete(id: string) {
    await this.prisma.announcement.delete({ where: { id } });
    return { deleted: true };
  }
}
