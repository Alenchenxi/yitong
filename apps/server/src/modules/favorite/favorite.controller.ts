import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { FavoriteService } from './favorite.service';
import { ListFavoritesQueryDto, ToggleFavoriteDto } from './dto/toggle-favorite.dto';

@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favorite: FavoriteService) {}

  @Post()
  async toggle(@Body() dto: ToggleFavoriteDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.favorite.toggle(uid, dto.targetType, dto.targetId));
  }

  @Get()
  async list(@Query() q: ListFavoritesQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    const page = parsePositiveInt(req.query.page as string | undefined, 1, 1, 10_000);
    const pageSize = parsePositiveInt(req.query.pageSize as string | undefined, 20, 1, 50);
    return ok(await this.favorite.list(uid, { targetType: q.targetType, page, pageSize }));
  }

  @Get('check')
  async check(@Query() q: ToggleFavoriteDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.favorite.check(uid, q.targetType, q.targetId));
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.favorite.delete(uid, id));
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
