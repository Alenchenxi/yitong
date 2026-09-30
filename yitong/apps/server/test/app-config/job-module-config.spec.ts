import { AppConfigController } from '../../src/modules/app-config/app-config.controller';
import {
  JOB_MODULE_ENABLED_KEY,
  AppConfigService,
} from '../../src/modules/app-config/app-config.service';
import { AdminService } from '../../src/modules/admin/admin.service';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../src/modules/auth/public.decorator';

describe('兼职板块展示配置', () => {
  function buildAppConfig(value?: unknown) {
    const prisma = {
      appConfig: {
        findUnique: jest.fn().mockResolvedValue(
          value === undefined ? null : { key: JOB_MODULE_ENABLED_KEY, value },
        ),
      },
    };
    const service = new AppConfigService(prisma as never);
    return { controller: new AppConfigController(service), prisma };
  }

  it('未配置时公开接口默认不展示用户端兼职板块', async () => {
    const { controller } = buildAppConfig();

    await expect(controller.getJobModuleVisibility()).resolves.toEqual({
      code: 0,
      data: { jobEnabled: false },
      message: 'ok',
    });
  });

  it('公开接口固定注册为 /app-config/job 且无需登录', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, AppConfigController);
    const method = AppConfigController.prototype.getJobModuleVisibility;
    const methodPath = Reflect.getMetadata(PATH_METADATA, method);
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, method);

    expect(controllerPath).toBe('app-config');
    expect(methodPath).toBe('job');
    expect(isPublic).toBe(true);
  });

  it.each([true, false])('公开接口返回管理员保存的布尔值 %p', async (value) => {
    const { controller } = buildAppConfig(value);

    await expect(controller.getJobModuleVisibility()).resolves.toEqual({
      code: 0,
      data: { jobEnabled: value },
      message: 'ok',
    });
  });

  it('数据库中的非布尔旧值按关闭处理', async () => {
    const { controller } = buildAppConfig('true');

    await expect(controller.getJobModuleVisibility()).resolves.toEqual({
      code: 0,
      data: { jobEnabled: false },
      message: 'ok',
    });
  });

  it.each([true, false])('管理端允许写入兼职板块开关 %p', async (value) => {
    const prisma = {
      appConfig: {
        upsert: jest.fn().mockImplementation(async (args) => args.create),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await admin.updateSetting(JOB_MODULE_ENABLED_KEY, value, 'admin-openid');

    expect(prisma.appConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: JOB_MODULE_ENABLED_KEY },
        create: expect.objectContaining({
          key: JOB_MODULE_ENABLED_KEY,
          value,
          updatedBy: 'admin-openid',
        }),
      }),
    );
  });

  it('管理端设置列表包含默认关闭的兼职板块开关', async () => {
    const prisma = {
      appConfig: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(admin.getSettings()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: JOB_MODULE_ENABLED_KEY,
          value: false,
        }),
      ]),
    );
  });

  it.each(['true', 1, null])('管理端拒绝非法兼职板块开关 %p', async (value) => {
    const prisma = {
      appConfig: {
        upsert: jest.fn(),
      },
    };
    const admin = new AdminService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect(
      admin.updateSetting(JOB_MODULE_ENABLED_KEY, value, 'admin-openid'),
    ).rejects.toMatchObject({ bizCode: 40003, status: 400 });
    expect(prisma.appConfig.upsert).not.toHaveBeenCalled();
  });
});
