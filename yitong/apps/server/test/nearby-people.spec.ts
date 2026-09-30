import { NearbyService } from '../src/modules/nearby/nearby.service';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import {
  NearbyController,
  TreeholeNearbyController,
} from '../src/modules/nearby/nearby.controller';

describe('附近的人', () => {
  const storedPresence = (longitude = 120.1551, latitude = 30.2741, locatedAt = new Date()) => ({
    longitude,
    latitude,
    locatedAt,
  });

  it('表白墙附近列表只返回公开身份和模糊距离，不暴露坐标', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    subject.prisma = {
      nearbyPresence: { findUnique: jest.fn().mockResolvedValue(storedPresence()) },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          identityId: 'user-near',
          nickname: '小桐',
          avatar: 'https://example.test/avatar.png',
          following: true,
          distanceKm: 1.42,
        },
      ]),
    };

    const result = await service.listPublic('user-self', {
      limit: 20,
    });

    expect(result).toMatchObject({
      enabled: true,
      list: [
        {
          userId: 'user-near',
          nickname: '小桐',
          avatarUrl: 'https://example.test/avatar.png',
          following: true,
          distanceLabel: '1-3公里',
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/longitude|latitude|\blng\b|\blat\b/);
  });

  it('附近列表只使用服务端保存且未过期的本人位置', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    const findUnique = jest.fn().mockResolvedValue(storedPresence(121.4737, 31.2304));
    const queryRaw = jest.fn().mockResolvedValue([]);
    subject.prisma = { nearbyPresence: { findUnique }, $queryRaw: queryRaw };

    await service.listPublic('user-self', { limit: 20 });

    expect(findUnique).toHaveBeenCalledWith({
      where: { identityId_channel: { identityId: 'user-self', channel: 'CONFESSION' } },
      select: { longitude: true, latitude: true, locatedAt: true },
    });
    const query = queryRaw.mock.calls[0][0] as { values: unknown[] };
    expect(query.values).toContain(121.4737);
    expect(query.values).toContain(31.2304);

    findUnique.mockResolvedValueOnce(
      storedPresence(121.4737, 31.2304, new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000)),
    );
    await expect(service.listPublic('user-self', { limit: 20 })).resolves.toEqual({
      enabled: false,
      list: [],
      nextCursor: null,
      hasMore: false,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('附近列表游标只携带模糊距离分段，并拒绝无效游标', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    const queryRaw = jest.fn().mockResolvedValue([
      {
        identityId: 'user-first',
        nickname: '第一位',
        avatar: null,
        following: false,
        distanceKm: 0.8,
      },
      {
        identityId: 'user-second',
        nickname: '第二位',
        avatar: null,
        following: false,
        distanceKm: 1.2,
      },
    ]);
    subject.prisma = {
      nearbyPresence: { findUnique: jest.fn().mockResolvedValue(storedPresence()) },
      $queryRaw: queryRaw,
    };

    const firstPage = await service.listPublic('user-self', {
      limit: 1,
    });

    expect(firstPage.list).toHaveLength(1);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toMatch(/^nearby:v1:/);
    const cursorPayload = JSON.parse(
      Buffer.from(firstPage.nextCursor!.slice('nearby:v1:'.length), 'base64url').toString('utf8'),
    );
    expect(cursorPayload).toEqual({
      v: 1,
      channel: 'CONFESSION',
      distanceBucket: 0,
      identityId: 'user-first',
    });
    expect(JSON.stringify(cursorPayload)).not.toMatch(
      /origin|longitude|latitude|distanceKm|\blng\b|\blat\b/,
    );

    await expect(
      service.listPublic('user-self', {
        limit: 1,
        cursor: 'nearby:v1:not-valid-base64',
      }),
    ).rejects.toMatchObject({ bizCode: 70005 });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
  it('跨日期变更线时使用环绕经度范围粗筛', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    const queryRaw = jest.fn().mockResolvedValue([]);
    subject.prisma = {
      nearbyPresence: { findUnique: jest.fn().mockResolvedValue(storedPresence(179.9, 0)) },
      $queryRaw: queryRaw,
    };

    await service.listPublic('user-self', { limit: 20 });

    const query = queryRaw.mock.calls[0][0] as { strings: string[] };
    expect(query.strings.join(' ')).toMatch(
      /longitude::double precision[^]*OR[^]*longitude::double precision/,
    );
  });

  it('附近可见必须显式开启，关闭后删除对应频道的位置记录', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ locatedAt: new Date('2026-09-06T08:00:00.000Z') });
    const upsert = jest.fn().mockResolvedValue({ locatedAt: new Date('2026-09-06T08:00:00.000Z') });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    subject.prisma = {
      nearbyPresence: { findUnique, upsert, deleteMany },
    };

    await expect(service.getPublicPresence('user-self')).resolves.toEqual({
      enabled: false,
      locatedAt: null,
    });
    await expect(
      service.enablePublic('user-self', { lng: 120.1551, lat: 30.2741 }),
    ).resolves.toEqual({ enabled: true, locatedAt: '2026-09-06T08:00:00.000Z' });
    await expect(service.disablePublic('user-self')).resolves.toEqual({ enabled: false });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          identityId_channel: {
            identityId: 'user-self',
            channel: 'CONFESSION',
          },
        },
        create: expect.objectContaining({
          identityId: 'user-self',
          channel: 'CONFESSION',
          longitude: 120.1551,
          latitude: 30.2741,
        }),
        update: expect.objectContaining({
          longitude: 120.1551,
          latitude: 30.2741,
        }),
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { identityId: 'user-self', channel: 'CONFESSION' },
    });
  });
  it('树洞附近列表只返回匿名身份并过滤真实用户字段', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    subject.prisma = {
      anonymousProfile: {
        findUnique: jest.fn().mockResolvedValue({ anonId: 'anon-self' }),
      },
      nearbyPresence: {
        findUnique: jest.fn().mockResolvedValue(storedPresence()),
      },
      $queryRaw: jest.fn().mockResolvedValue([
        {
          identityId: 'anon-near',
          nickname: '月光信箱',
          avatar: 'moon',
          following: false,
          distanceKm: 0.6,
        },
      ]),
    };

    const result = await service.listAnonymous('anon-self', {
      limit: 20,
    });

    expect(result).toMatchObject({
      enabled: true,
      list: [
        {
          anonId: 'anon-near',
          nickname: '月光信箱',
          avatar: 'moon',
          following: false,
          distanceLabel: '1公里内',
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /userId|uid|openid|longitude|latitude|\blng\b|\blat\b/,
    );
  });
  it('树洞附近可见使用匿名身份鉴权并独立保存 TREEHOLE 频道', async () => {
    const service = Object.create(NearbyService.prototype) as NearbyService;
    const subject = service as any;
    const upsert = jest.fn().mockResolvedValue({ locatedAt: new Date('2026-09-06T08:30:00.000Z') });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    subject.prisma = {
      nearbyPresence: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
        deleteMany,
      },
    };

    await expect(service.getAnonymousPresence('anon-self')).resolves.toEqual({
      enabled: false,
      locatedAt: null,
    });
    await expect(
      service.enableAnonymous('anon-self', { lng: 120.1551, lat: 30.2741 }),
    ).resolves.toEqual({ enabled: true, locatedAt: '2026-09-06T08:30:00.000Z' });
    await expect(service.disableAnonymous('anon-self')).resolves.toEqual({ enabled: false });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          identityId_channel: {
            identityId: 'anon-self',
            channel: 'TREEHOLE',
          },
        },
        create: expect.objectContaining({
          identityId: 'anon-self',
          channel: 'TREEHOLE',
        }),
      }),
    );
    expect(deleteMany).toHaveBeenCalledWith({
      where: { identityId: 'anon-self', channel: 'TREEHOLE' },
    });
    expect(JSON.stringify(await service.disableAnonymous('anon-self'))).not.toMatch(
      /userId|uid|openid/,
    );
  });
  it('公开路由分别提供实名与匿名的位置状态、启停和列表接口', () => {
    const methodRoute = (controller: object, method: string) => ({
      path: Reflect.getMetadata(PATH_METADATA, (controller as any)[method]),
      method: Reflect.getMetadata(METHOD_METADATA, (controller as any)[method]),
    });

    expect(Reflect.getMetadata(PATH_METADATA, NearbyController)).toBe('/');
    expect(methodRoute(NearbyController.prototype, 'publicPresence')).toEqual({
      path: 'users/me/nearby-presence',
      method: RequestMethod.GET,
    });
    expect(methodRoute(NearbyController.prototype, 'enablePublic')).toEqual({
      path: 'users/me/nearby-presence',
      method: RequestMethod.PUT,
    });
    expect(methodRoute(NearbyController.prototype, 'disablePublic')).toEqual({
      path: 'users/me/nearby-presence',
      method: RequestMethod.DELETE,
    });
    expect(methodRoute(NearbyController.prototype, 'publicList')).toEqual({
      path: 'users/nearby',
      method: RequestMethod.GET,
    });

    expect(Reflect.getMetadata(PATH_METADATA, TreeholeNearbyController)).toBe('treehole');
    expect(methodRoute(TreeholeNearbyController.prototype, 'anonymousPresence')).toEqual({
      path: 'nearby-presence',
      method: RequestMethod.GET,
    });
    expect(methodRoute(TreeholeNearbyController.prototype, 'enableAnonymous')).toEqual({
      path: 'nearby-presence',
      method: RequestMethod.PUT,
    });
    expect(methodRoute(TreeholeNearbyController.prototype, 'disableAnonymous')).toEqual({
      path: 'nearby-presence',
      method: RequestMethod.DELETE,
    });
    expect(methodRoute(TreeholeNearbyController.prototype, 'anonymousList')).toEqual({
      path: 'nearby',
      method: RequestMethod.GET,
    });
  });
});
