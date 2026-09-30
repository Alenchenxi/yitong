import { Body, Controller, Delete, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { Public } from '../auth/public.decorator';
import { AnonGuard } from '../treehole/anon.guard';
import { NearbyListQueryDto, NearbyLocationDto } from './dto/nearby.dto';
import { NearbyService } from './nearby.service';

@Controller()
export class NearbyController {
  constructor(private readonly nearby: NearbyService) {}

  @Get('users/me/nearby-presence')
  async publicPresence(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.nearby.getPublicPresence(uid));
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Put('users/me/nearby-presence')
  async enablePublic(@Body() dto: NearbyLocationDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.nearby.enablePublic(uid, dto));
  }

  @Delete('users/me/nearby-presence')
  async disablePublic(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.nearby.disablePublic(uid));
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('users/nearby')
  async publicList(@Query() query: NearbyListQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(
      await this.nearby.listPublic(uid, {
        cursor: query.cursor,
        limit: query.limit ?? 20,
      }),
    );
  }
}

@Public()
@UseGuards(AnonGuard)
@Controller('treehole')
export class TreeholeNearbyController {
  constructor(private readonly nearby: NearbyService) {}

  @Get('nearby-presence')
  async anonymousPresence(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.nearby.getAnonymousPresence(anonId));
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Put('nearby-presence')
  async enableAnonymous(@Body() dto: NearbyLocationDto, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.nearby.enableAnonymous(anonId, dto));
  }

  @Delete('nearby-presence')
  async disableAnonymous(@Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.nearby.disableAnonymous(anonId));
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('nearby')
  async anonymousList(@Query() query: NearbyListQueryDto, @Req() req: Request) {
    const anonId = (req as AuthenticatedRequest).user!.uid;
    return ok(
      await this.nearby.listAnonymous(anonId, {
        cursor: query.cursor,
        limit: query.limit ?? 20,
      }),
    );
  }
}
