import { HttpStatus, Injectable } from '@nestjs/common';
import { NearbyChannel, Prisma } from '@prisma/client';
import { BizException } from '../../common/exceptions/biz.exception';
import { PrismaService } from '../../prisma/prisma.service';

interface NearbyListInput {
  cursor?: string;
  limit: number;
}

interface NearbyRow {
  identityId: string;
  nickname: string;
  avatar: string | null;
  following: boolean;
  distanceKm: number;
}

interface NearbyCursor {
  v: 1;
  channel: NearbyChannel;
  distanceBucket: number;
  identityId: string;
}

const EARTH_RADIUS_KM = 6_371;
const SEARCH_RADIUS_KM = 50;
const PRESENCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const CURSOR_PREFIX = 'nearby:v1:';

function toDistanceLabel(distanceKm: number): string {
  if (distanceKm < 1) return '1公里内';
  if (distanceKm < 3) return '1-3公里';
  if (distanceKm < 10) return '3-10公里';
  return '10-50公里';
}

function toDistanceBucket(distanceKm: number): number {
  if (distanceKm < 1) return 0;
  if (distanceKm < 3) return 1;
  if (distanceKm < 10) return 2;
  return 3;
}

function encodeCursor(payload: NearbyCursor): string {
  return CURSOR_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(input: NearbyListInput, channel: NearbyChannel): NearbyCursor | null {
  if (!input.cursor) return null;
  try {
    if (!input.cursor.startsWith(CURSOR_PREFIX)) throw new Error('prefix');
    const payload = JSON.parse(
      Buffer.from(input.cursor.slice(CURSOR_PREFIX.length), 'base64url').toString('utf8'),
    ) as NearbyCursor;
    if (
      payload.v !== 1 ||
      payload.channel !== channel ||
      typeof payload.identityId !== 'string' ||
      !Number.isInteger(payload.distanceBucket) ||
      payload.distanceBucket < 0 ||
      payload.distanceBucket > 3
    )
      throw new Error('payload');
    return payload;
  } catch {
    throw new BizException(70005, '附近列表已更新，请重新加载', HttpStatus.BAD_REQUEST);
  }
}

function longitudeFilter(originLng: number, lngDelta: number): Prisma.Sql {
  if (lngDelta >= 180) return Prisma.empty;
  const minLng = originLng - lngDelta;
  const maxLng = originLng + lngDelta;
  if (minLng < -180) {
    return Prisma.sql`AND (
      p.longitude::double precision >= ${minLng + 360}
      OR p.longitude::double precision <= ${maxLng}
    )`;
  }
  if (maxLng > 180) {
    return Prisma.sql`AND (
      p.longitude::double precision >= ${minLng}
      OR p.longitude::double precision <= ${maxLng - 360}
    )`;
  }
  return Prisma.sql`AND p.longitude::double precision BETWEEN ${minLng} AND ${maxLng}`;
}

const DISTANCE_BUCKET_SQL = Prisma.sql`CASE
  WHEN nearby."distanceKm" < 1 THEN 0
  WHEN nearby."distanceKm" < 3 THEN 1
  WHEN nearby."distanceKm" < 10 THEN 2
  ELSE 3
END`;

@Injectable()
export class NearbyService {
  constructor(private readonly prisma: PrismaService) {}
  async getPublicPresence(uid: string) {
    const presence = await this.prisma.nearbyPresence.findUnique({
      where: { identityId_channel: { identityId: uid, channel: NearbyChannel.CONFESSION } },
      select: { locatedAt: true },
    });
    return {
      enabled: !!presence,
      locatedAt: presence?.locatedAt.toISOString() ?? null,
    };
  }

  async enablePublic(uid: string, location: { lng: number; lat: number }) {
    const locatedAt = new Date();
    const presence = await this.prisma.nearbyPresence.upsert({
      where: { identityId_channel: { identityId: uid, channel: NearbyChannel.CONFESSION } },
      create: {
        identityId: uid,
        channel: NearbyChannel.CONFESSION,
        longitude: location.lng,
        latitude: location.lat,
        locatedAt,
      },
      update: {
        longitude: location.lng,
        latitude: location.lat,
        locatedAt,
      },
      select: { locatedAt: true },
    });
    return { enabled: true, locatedAt: presence.locatedAt.toISOString() };
  }

  async disablePublic(uid: string) {
    await this.prisma.nearbyPresence.deleteMany({
      where: { identityId: uid, channel: NearbyChannel.CONFESSION },
    });
    return { enabled: false };
  }
  async getAnonymousPresence(anonId: string) {
    const presence = await this.prisma.nearbyPresence.findUnique({
      where: { identityId_channel: { identityId: anonId, channel: NearbyChannel.TREEHOLE } },
      select: { locatedAt: true },
    });
    return {
      enabled: !!presence,
      locatedAt: presence?.locatedAt.toISOString() ?? null,
    };
  }

  async enableAnonymous(anonId: string, location: { lng: number; lat: number }) {
    const locatedAt = new Date();
    const presence = await this.prisma.nearbyPresence.upsert({
      where: { identityId_channel: { identityId: anonId, channel: NearbyChannel.TREEHOLE } },
      create: {
        identityId: anonId,
        channel: NearbyChannel.TREEHOLE,
        longitude: location.lng,
        latitude: location.lat,
        locatedAt,
      },
      update: {
        longitude: location.lng,
        latitude: location.lat,
        locatedAt,
      },
      select: { locatedAt: true },
    });
    return { enabled: true, locatedAt: presence.locatedAt.toISOString() };
  }

  async disableAnonymous(anonId: string) {
    await this.prisma.nearbyPresence.deleteMany({
      where: { identityId: anonId, channel: NearbyChannel.TREEHOLE },
    });
    return { enabled: false };
  }
  async listAnonymous(anonId: string, input: NearbyListInput) {
    const profile = await this.prisma.anonymousProfile.findUnique({
      where: { anonId },
      select: { anonId: true },
    });
    if (!profile) {
      throw new BizException(30001, '匿名身份不存在', HttpStatus.UNAUTHORIZED);
    }
    const cutoff = new Date(Date.now() - PRESENCE_MAX_AGE_MS);
    const presence = await this.prisma.nearbyPresence.findUnique({
      where: {
        identityId_channel: {
          identityId: anonId,
          channel: NearbyChannel.TREEHOLE,
        },
      },
      select: { longitude: true, latitude: true, locatedAt: true },
    });
    if (!presence || presence.locatedAt < cutoff) {
      return { enabled: false, list: [], nextCursor: null, hasMore: false };
    }

    const cursor = decodeCursor(input, NearbyChannel.TREEHOLE);
    const originLng = Number(presence.longitude);
    const originLat = Number(presence.latitude);
    const latDelta = SEARCH_RADIUS_KM / 111.32;
    const cosLat = Math.max(Math.cos((originLat * Math.PI) / 180), 0.01);
    const lngDelta = Math.min(180, SEARCH_RADIUS_KM / (111.32 * cosLat));
    const lngFilter = longitudeFilter(originLng, lngDelta);
    const cursorFilter = cursor
      ? Prisma.sql`AND (
          ${DISTANCE_BUCKET_SQL} > ${cursor.distanceBucket}
          OR (${DISTANCE_BUCKET_SQL} = ${cursor.distanceBucket} AND nearby."identityId" > ${cursor.identityId})
        )`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      WITH nearby AS (
        SELECT
          ap.anon_id AS "identityId",
          ap.nickname,
          ap.avatar,
          EXISTS (
            SELECT 1 FROM anon_follows af
            WHERE af.follower_anon_id = ${anonId} AND af.followee_anon_id = ap.anon_id
          ) AS following,
          ROUND((
            ${EARTH_RADIUS_KM} * ACOS(LEAST(1, GREATEST(-1,
              SIN(RADIANS(${originLat})) * SIN(RADIANS(p.latitude::double precision))
              + COS(RADIANS(${originLat})) * COS(RADIANS(p.latitude::double precision))
              * COS(RADIANS(p.longitude::double precision - ${originLng}))
            )))
          )::numeric, 3)::double precision AS "distanceKm"
        FROM nearby_presences p
        JOIN anonymous_profiles ap ON ap.anon_id = p.identity_id
        JOIN users u ON u.id = ap.user_id
        WHERE p.channel = CAST(${NearbyChannel.TREEHOLE} AS "NearbyChannel")
          AND ap.anon_id <> ${anonId}
          AND p.located_at >= ${cutoff}
          AND u.deleted_at IS NULL
          AND p.latitude::double precision BETWEEN ${originLat - latDelta} AND ${originLat + latDelta}
          ${lngFilter}
          AND NOT EXISTS (
            SELECT 1 FROM anon_blocks ab
            WHERE (ab.blocker_anon_id = ${anonId} AND ab.blocked_anon_id = ap.anon_id)
               OR (ab.blocker_anon_id = ap.anon_id AND ab.blocked_anon_id = ${anonId})
          )
      )
      SELECT * FROM nearby
      WHERE nearby."distanceKm" <= ${SEARCH_RADIUS_KM}
      ${cursorFilter}
      ORDER BY ${DISTANCE_BUCKET_SQL} ASC, nearby."identityId" ASC
      LIMIT ${input.limit + 1}
    `);
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      enabled: true,
      list: page.map((row) => ({
        anonId: row.identityId,
        nickname: row.nickname,
        avatar: row.avatar,
        following: row.following,
        distanceLabel: toDistanceLabel(row.distanceKm),
      })),
      nextCursor:
        hasMore && last
          ? encodeCursor({
              v: 1,
              channel: NearbyChannel.TREEHOLE,
              distanceBucket: toDistanceBucket(last.distanceKm),
              identityId: last.identityId,
            })
          : null,
      hasMore,
    };
  }

  async listPublic(uid: string, input: NearbyListInput) {
    const cutoff = new Date(Date.now() - PRESENCE_MAX_AGE_MS);
    const presence = await this.prisma.nearbyPresence.findUnique({
      where: { identityId_channel: { identityId: uid, channel: NearbyChannel.CONFESSION } },
      select: { longitude: true, latitude: true, locatedAt: true },
    });
    if (!presence || presence.locatedAt < cutoff) {
      return { enabled: false, list: [], nextCursor: null, hasMore: false };
    }

    const cursor = decodeCursor(input, NearbyChannel.CONFESSION);
    const originLng = Number(presence.longitude);
    const originLat = Number(presence.latitude);
    const latDelta = SEARCH_RADIUS_KM / 111.32;
    const cosLat = Math.max(Math.cos((originLat * Math.PI) / 180), 0.01);
    const lngDelta = Math.min(180, SEARCH_RADIUS_KM / (111.32 * cosLat));
    const lngFilter = longitudeFilter(originLng, lngDelta);
    const cursorFilter = cursor
      ? Prisma.sql`AND (
          ${DISTANCE_BUCKET_SQL} > ${cursor.distanceBucket}
          OR (${DISTANCE_BUCKET_SQL} = ${cursor.distanceBucket} AND nearby."identityId" > ${cursor.identityId})
        )`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      WITH nearby AS (
        SELECT
          u.id AS "identityId",
          u.nickname,
          u.avatar_url AS avatar,
          EXISTS (
            SELECT 1 FROM follows f
            WHERE f.follower_id = ${uid} AND f.followee_id = u.id
          ) AS following,
          ROUND((
            ${EARTH_RADIUS_KM} * ACOS(LEAST(1, GREATEST(-1,
              SIN(RADIANS(${originLat})) * SIN(RADIANS(p.latitude::double precision))
              + COS(RADIANS(${originLat})) * COS(RADIANS(p.latitude::double precision))
              * COS(RADIANS(p.longitude::double precision - ${originLng}))
            )))
          )::numeric, 3)::double precision AS "distanceKm"
        FROM nearby_presences p
        JOIN users u ON u.id = p.identity_id
        WHERE p.channel = CAST(${NearbyChannel.CONFESSION} AS "NearbyChannel")
          AND p.identity_id <> ${uid}
          AND p.located_at >= ${cutoff}
          AND u.deleted_at IS NULL
          AND p.latitude::double precision BETWEEN ${originLat - latDelta} AND ${originLat + latDelta}
          ${lngFilter}
      )
      SELECT * FROM nearby
      WHERE nearby."distanceKm" <= ${SEARCH_RADIUS_KM}
      ${cursorFilter}
      ORDER BY ${DISTANCE_BUCKET_SQL} ASC, nearby."identityId" ASC
      LIMIT ${input.limit + 1}
    `);
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      enabled: true,
      list: page.map((row) => ({
        userId: row.identityId,
        nickname: row.nickname,
        avatarUrl: row.avatar,
        following: row.following,
        distanceLabel: toDistanceLabel(row.distanceKm),
      })),
      nextCursor:
        hasMore && last
          ? encodeCursor({
              v: 1,
              channel: NearbyChannel.CONFESSION,
              distanceBucket: toDistanceBucket(last.distanceKm),
              identityId: last.identityId,
            })
          : null,
      hasMore,
    };
  }
}
