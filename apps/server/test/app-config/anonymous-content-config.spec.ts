import { AppConfigController } from '../../src/modules/app-config/app-config.controller';
import {
  ANONYMOUS_CONTENT_ENABLED_KEY,
  AppConfigService,
} from '../../src/modules/app-config/app-config.service';
import { AdminService } from '../../src/modules/admin/admin.service';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../src/modules/auth/public.decorator';
import { FavoriteService } from '../../src/modules/favorite/favorite.service';
import { NotificationService } from '../../src/modules/notification/notification.service';

describe('匿名内容展示配置', () => {
  function buildAppConfig(value?: unknown) {
    const prisma = {
      appConfig: {
        findUnique: jest.fn().mockResolvedValue(
          value === undefined ? null : { key: ANONYMOUS_CONTENT_ENABLED_KEY, value },
        ),
      },
    };
    const service = new AppConfigService(prisma as never);
    return { controller: new AppConfigController(service), prisma };
  }

  it('未配置时公开接口默认不展示匿名内容', async () => {
    const { controller } = buildAppConfig();

    await expect(controller.getAnonymousContentVisibility()).resolves.toEqual({
      code: 0,
      data: { anonymousContentEnabled: false },
      message: 'ok',
    });
  });

  it('公开接口固定注册为 /app-config/anonymous-content 且无需登录', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, AppConfigController);
    const method = AppConfigController.prototype.getAnonymousContentVisibility;
    const methodPath = Reflect.getMetadata(PATH_METADATA, method);
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method);

    expect(controllerPath).toBe('app-config');
    expect(methodPath).toBe('anonymous-content');
    expect(isPublic).toBe(true);
  });

  it.each([true, false])('公开接口返回管理员保存的布尔值 %p', async (value) => {
    const { controller } = buildAppConfig(value);

    await expect(controller.getAnonymousContentVisibility()).resolves.toEqual({
      code: 0,
      data: { anonymousContentEnabled: value },
      message: 'ok',
    });
  });

  it('数据库中的非布尔旧值按关闭处理', async () => {
    const { controller } = buildAppConfig('true');

    await expect(controller.getAnonymousContentVisibility()).resolves.toEqual({
      code: 0,
      data: { anonymousContentEnabled: false },
      message: 'ok',
    });
  });

  it.each([true, false])('管理端允许写入匿名内容展示开关 %p', async (value) => {
    const prisma = {
      appConfig: {
        upsert: jest.fn().mockImplementation(async (args) => args.create),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never);

    await admin.updateSetting(ANONYMOUS_CONTENT_ENABLED_KEY, value, 'admin-openid');

    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: ANONYMOUS_CONTENT_ENABLED_KEY },
        create: expect.objectContaining({
          key: ANONYMOUS_CONTENT_ENABLED_KEY,
          value,
          updatedBy: 'admin-openid',
        }),
      }),
    );
  });

  it('管理端设置列表包含默认关闭的匿名内容开关', async () => {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never);

    await expect(admin.getSettings()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: ANONYMOUS_CONTENT_ENABLED_KEY,
          value: false,
        }),
      ]),
    );
  });

  it.each(['true', 1, null])('管理端拒绝非法匿名内容展示开关 %p', async (value) => {
    const prisma = {
      appConfig: {
        upsert: jest.fn(),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never);

    await expect(
      admin.updateSetting(ANONYMOUS_CONTENT_ENABLED_KEY, value, 'admin-openid'),
    ).rejects.toMatchObject({ bizCode: 40003, status: 400 });
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });
});

describe('匿名表白墙关联内容标记', () => {
  it('收藏列表批量标记匿名表白墙和树洞目标', async () => {
    const now = new Date('2026-09-02T00:00:00.000Z');
    const favorites = [
      { id: 'fav-post', userId: 'u1', targetType: 'post', targetId: 'post-anon', createdAt: now },
      { id: 'fav-treehole', userId: 'u1', targetType: 'anon_post', targetId: 'anon-1', createdAt: now },
      { id: 'fav-job', userId: 'u1', targetType: 'job_post', targetId: 'job-1', createdAt: now },
    ];
    const prisma = {
      favorite: {
        findMany: jest.fn().mockResolvedValue(favorites),
        count: jest.fn().mockResolvedValue(favorites.length),
      },
      post: {
        findMany: jest.fn().mockResolvedValue([{ id: 'post-anon' }]),
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const service = new FavoriteService(prisma as never);

    const result = await service.list('u1', { page: 1, pageSize: 20 });

    expect(result.list.map((item) => item.targetAnonymous)).toEqual([true, true, false]);
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['post-anon'] }, isAnonymous: true },
      select: { id: true },
    });
  });

  it('通知列表批量标记匿名表白墙目标', async () => {
    const now = new Date('2026-09-02T00:00:00.000Z');
    const notifications = [
      {
        id: 'n-anon', type: 'post_like', title: '表白墙', content: '新点赞',
        targetType: 'post', targetId: 'post-anon', extraId: null, read: false, createdAt: now,
      },
      {
        id: 'n-public', type: 'post_like', title: '表白墙', content: '新点赞',
        targetType: 'post', targetId: 'post-public', extraId: null, read: false, createdAt: now,
      },
    ];
    const prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue(notifications),
        count: jest.fn().mockResolvedValue(notifications.length),
      },
      post: {
        findMany: jest.fn().mockResolvedValue([{ id: 'post-anon' }]),
      },
    };
    const service = new NotificationService(prisma as never, {} as never);

    const result = await service.list('u1', false, 1, 20);

    expect(result.list.map((item) => item.targetAnonymous)).toEqual([true, false]);
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['post-anon', 'post-public'] }, isAnonymous: true },
      select: { id: true },
    });
  });
});
